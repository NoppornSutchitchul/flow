"""FastAPI entrypoint for Flow."""
from __future__ import annotations

import asyncio
import json
import re
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response
from sqlmodel import Session, func, select

from .db import engine, init_db
from .models import (
    GuestRoom, HotelLocation, JobTitle, Note, OrgDepartment, Product, ProductCategory, Request,
    RequestItem, StockAdjustment, TimelineEvent, User,
)
from .auth.auth_util import create_auth_session, get_current_user, get_optional_user, revoke_auth_session
from .auth.password_util import hash_password, validate_new_password, verify_password
from .auth.user_auth import derive_username, find_user_by_username, normalize_username, username_taken, validate_login_username
from .schemas import (
    DashboardStats, GuestRoomCreate, GuestRoomRead, GuestRoomUpdate,
    RoomAttributeOptionCreate, RoomAttributeOptionRead, RoomAttributeOptionUpdate,
    HotelLocationCreate, HotelLocationRead, HotelLocationUpdate,
    JobTitleCreate, JobTitleRead, JobTitleUpdate,
    BlockerUserRef,
    JobTitleBlockerRef,
    MoveDepartmentJobTitlesBody,
    OrgDeleteCheckRead,
    OrgDepartmentCreate, OrgDepartmentRead, OrgDepartmentUpdate,
    NoteCreate, NoteRead, ProductCreate, ProductRead,
    ProductCategoryCreate, ProductCategoryRead, ProductCategoryUpdate,
    ProductUpdate, ReportSummary, ReportPresetData, ReportPresetMeta,
    CustomReportCreate, CustomReportRead, CustomReportShareCreate, CustomReportSharesRead,
    CustomReportSharingUpdate, CustomReportUpdate,
    RequestAction, RequestCreate, RequestReassign,
    RequestHoldUpdate,
    RequestScheduleUpdate,
    STOCK_WRITE_OFF_REASONS,
    StockAdjustmentRead,
    RequestDetail, RequestRead, StockAdjust, StockCheckRequest, TimeAlertSettings,
    TimeAlertSettingsUpdate,
    ChangePasswordRequest,
    AdminResetPasswordRequest,
    LoginRequest,
    LoginResponse,
    AssignableStaffRead,
    AssignableStaffDeptRead,
    UserCreate, UserRead,
    UserUpdate,
)
from .catalog.product_catalog import sync_product_catalog
from .reports.report_export import ExportDocumentModel
from .hotel.room_options import (
    assert_guest_room_against_options,
    create_room_option,
    delete_room_option,
    list_room_options,
    update_room_option,
)
from .seed.seed import (
    normalize_hotel_location_hints,
    purge_unspecified_hotel_location,
    seed_guest_rooms_if_empty,
    seed_room_options_if_empty,
    seed_hotel_locations_if_empty,
    sync_hotel_locations_catalog,
    seed_if_empty,
    seed_departments_if_empty,
    sync_job_titles_catalog,
)
from .seed.seed_report_demo import seed_report_demo_data
from .services import (
    add_event, assert_stock_available_for_lines, assign_request_now, auto_assign,
    assignable_staff_snapshot,
    has_assignable_staff,
    consume_stock,
    count_low_stock_products,
    count_open_overdue_requests,
    flush_pending_request_timers,
    is_future_scheduled,
    list_stock_alert_products,
    requests_to_read,
    is_scheduled_hold,
    can_adjust_inventory, can_edit_catalog, department_for_products,
    requests_list_scope_for_user,
    backfill_public_area_staff_work_zones,
    effective_permissions, eligible_assignee, items_text_for, next_code, can_view_reports,
    can_use_quick_request,
    get_time_alert_settings, save_time_alert_settings, current_response_budget_minutes,
    product_to_read, request_to_detail, request_to_read, schedule_timeline_detail,
    to_naive_utc,
    set_request_assignee,
    permissions_json_from_client, default_permissions, FEATURE_KEYS,
    publish_request_changed, publish_request_changed_by_id,
    sync_offline_user_assignments,
    retry_pending_assignments_when_staff_online,
    user_to_read,
)
from .ws import hub


async def _periodic_request_timer_flush() -> None:
    """Background scheduler so hot GET routes skip timer scans."""
    while True:
        await asyncio.sleep(8)
        try:
            with Session(engine) as s:
                changed = flush_pending_request_timers(s, force=True)
                if changed:
                    s.commit()
                    for rid in changed:
                        publish_request_changed_by_id(s, rid)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_if_empty()
    seed_departments_if_empty()
    from .seed.seed import (
        migrate_job_titles_restore_department_scope,
        migrate_org_departments_to_english_names,
        migrate_renamed_job_title_labels,
        migrate_usernames_to_first_name,
    )

    migrate_org_departments_to_english_names()
    migrate_job_titles_restore_department_scope()
    migrate_renamed_job_title_labels()
    migrate_usernames_to_first_name()
    sync_job_titles_catalog()
    from .seed.seed import migrate_ensure_bell_boy_department_and_staff

    migrate_ensure_bell_boy_department_and_staff()
    seed_hotel_locations_if_empty()
    sync_hotel_locations_catalog()
    purge_unspecified_hotel_location()
    normalize_hotel_location_hints()
    seed_room_options_if_empty()
    seed_guest_rooms_if_empty()
    sync_product_catalog()
    with Session(engine) as s:
        backfill_public_area_staff_work_zones(s)
    hub.attach_loop(asyncio.get_running_loop())
    flush_task = asyncio.create_task(_periodic_request_timer_flush())
    yield
    flush_task.cancel()
    try:
        await flush_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Flow API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Auth ----------------

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    username = normalize_username(payload.username)
    if not username or not payload.password:
        raise HTTPException(400, "username and password required")
    with Session(engine) as s:
        user = find_user_by_username(s, username)
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(401, "invalid username or password")
        if not user.active:
            raise HTTPException(403, "account suspended")
        from .activity_log import log_activity

        log_activity(
            s,
            action="auth.login",
            summary="Signed in",
            actor=user,
        )
        s.commit()
        user_id = user.id  # type: ignore[arg-type]
        user_out = user_to_read(user)  # type: ignore[arg-type]
    token = create_auth_session(user_id)
    return LoginResponse(token=token, user=user_out)


@app.get("/api/auth/me", response_model=UserRead)
def auth_me(current: User = Depends(get_current_user)) -> UserRead:
    return user_to_read(current)  # type: ignore[return-value]


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)) -> dict:
    user_id: int | None = None
    if authorization and authorization.lower().startswith("bearer "):
        from .auth.auth_util import get_user_for_token

        token = authorization[7:].strip()
        user = get_user_for_token(token)
        if user and user.id is not None:
            user_id = user.id
        revoke_auth_session(token)
    if user_id is not None:
        sync_offline_user_assignments(user_id)
        hub.disconnect_user_sessions(user_id)
    return {"ok": True}


@app.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current: User = Depends(get_current_user),
) -> dict:
    new_pw = payload.new_password.strip()
    try:
        validate_new_password(new_pw)
    except ValueError as e:
        code = str(e)
        if code == "invalid_chars":
            raise HTTPException(400, detail={"code": "password_invalid_chars"}) from e
        raise HTTPException(400, detail={"code": "password_too_short"}) from e
    with Session(engine) as s:
        user = s.get(User, current.id)
        if not user:
            raise HTTPException(404, detail={"code": "user_not_found"})
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(400, detail={"code": "wrong_current_password"})
        user.password_hash = hash_password(new_pw)
        s.add(user)
        s.commit()
    return {"ok": True}


# ---------------- Users ----------------

@app.get("/api/users", response_model=list[UserRead])
def list_users(
    role: Optional[str] = None,
    include_inactive: bool = Query(False, alias="include_inactive"),
) -> list[UserRead]:
    with Session(engine) as s:
        q = select(User)
        if not include_inactive:
            q = q.where(User.active == True)  # noqa: E712
        if role:
            q = q.where(User.role == role)
        q = q.order_by(User.name, User.id)
        return [user_to_read(u) for u in s.exec(q).all()]


@app.get("/api/assignable-staff", response_model=AssignableStaffRead)
def get_assignable_staff(
    room: str = Query(""),
    departments: str = Query(..., description="Comma-separated department codes"),
    product_ids: Optional[str] = Query(
        None,
        description="Comma-separated product ids (limits staff by product job-title rules)",
    ),
) -> AssignableStaffRead:
    dept_list = [d.strip() for d in departments.split(",") if d.strip()]
    if not dept_list:
        raise HTTPException(400, "departments required")
    pid_list: list[int] = []
    if product_ids:
        for part in product_ids.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                pid_list.append(int(part))
            except ValueError as e:
                raise HTTPException(400, "invalid product_ids") from e
    with Session(engine) as s:
        snap = assignable_staff_snapshot(
            s,
            room=room,
            departments=dept_list,
            product_ids=pid_list or None,
        )
    return AssignableStaffRead(
        departments={
            dept: AssignableStaffDeptRead(
                available=bool(row["available"]),
                user_ids=[int(i) for i in row["user_ids"]],  # type: ignore[union-attr]
            )
            for dept, row in snap.items()
        },
    )


@app.post("/api/users", response_model=UserRead)
def create_user(payload: UserCreate) -> UserRead:
    name = payload.name.strip()
    password = payload.password.strip()
    if not name:
        raise HTTPException(400, "name required")
    try:
        username = validate_login_username(payload.username)
    except ValueError as e:
        code = str(e)
        if code == "invalid_chars":
            raise HTTPException(400, "username invalid characters") from e
        raise HTTPException(400, "username too short") from e
    try:
        validate_new_password(password)
    except ValueError as e:
        code = str(e)
        if code == "invalid_chars":
            raise HTTPException(400, "password invalid characters") from e
        raise HTTPException(400, "password must be at least 4 characters") from e
    initials = "".join(part[0] for part in name.split()[:2]).upper() or "?"
    color = payload.color or "#cbb6d3"
    pj = None
    if payload.permissions is not None:
        merged = default_permissions(payload.role)
        for k, v in payload.permissions.items():
            if k in FEATURE_KEYS and isinstance(v, bool):
                merged[k] = v
        pj = permissions_json_from_client(payload.role, merged)
    with Session(engine) as s:
        if username_taken(s, username):
            raise HTTPException(409, "username_taken")
        _validate_user_job_title_department(
            s,
            job_title=payload.job_title,
            department=payload.department,
        )
        u = User(
            name=name,
            username=username,
            password_hash=hash_password(password),
            initials=initials,
            role=payload.role,
            department=payload.department,
            job_title=payload.job_title,
            work_zone=payload.work_zone,
            color=color,
            active=payload.active,
            permissions_json=pj,
        )
        s.add(u)
        s.flush()
        from .activity_log import log_activity

        log_activity(
            s,
            action="user.create",
            summary=f"Created user {name}",
            entity_type="user",
            entity_id=u.id,
        )
        s.commit()
        s.refresh(u)
    hub.publish("users.changed")
    return user_to_read(u)  # type: ignore[return-value]


@app.patch("/api/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate) -> UserRead:
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "user not found")
        data = payload.model_dump(exclude_unset=True)
        perm_eff = data.pop("permissions", None)
        if "name" in data and data["name"]:
            parts = str(data["name"]).split()
            u.initials = "".join(part[0] for part in parts[:2]).upper() or "?"
            u.username = derive_username(s, str(data["name"]), exclude_id=u.id)
        if "department" in data or "job_title" in data:
            _validate_user_job_title_department(
                s,
                job_title=data.get("job_title", u.job_title),
                department=str(data.get("department", u.department)),
            )
        for k, v in data.items():
            setattr(u, k, v)
        if perm_eff is not None:
            merged = default_permissions(u.role)
            for k, v in perm_eff.items():
                if k in FEATURE_KEYS and isinstance(v, bool):
                    merged[k] = v
            u.permissions_json = permissions_json_from_client(u.role, merged)
        s.add(u)
        s.commit()
        s.refresh(u)
    hub.publish("users.changed")
    return user_to_read(u)  # type: ignore[return-value]


@app.post("/api/users/sync-departments-from-job-titles")
def sync_users_departments_from_job_titles(
    job_title_department: Optional[str] = None,
) -> dict:
    """Align staff departments with job-title preset departments (optional filter by title dept)."""
    with Session(engine) as s:
        moved = _sync_users_departments_from_job_title_presets(
            s,
            only_job_title_department=job_title_department,
        )
        s.commit()
    hub.publish("users.changed")
    return {"ok": True, "moved": moved}


@app.post("/api/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    payload: AdminResetPasswordRequest,
    current: User = Depends(get_current_user),
) -> dict:
    """Admin sets a new password when a staff member forgot theirs."""
    if current.role != "admin":
        raise HTTPException(403, "only admin can reset user passwords")
    new_pw = payload.new_password.strip()
    try:
        validate_new_password(new_pw)
    except ValueError as e:
        code = str(e)
        if code == "invalid_chars":
            raise HTTPException(400, "password invalid characters") from e
        raise HTTPException(400, "password must be at least 4 characters") from e
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "user not found")
        u.password_hash = hash_password(new_pw)
        s.add(u)
        from .activity_log import log_activity

        log_activity(
            s,
            action="user.password_reset",
            summary=f"Reset password for {u.name}",
            entity_type="user",
            entity_id=u.id,
            actor_id=current.id,
        )
        s.commit()
    return {"ok": True}


@app.delete("/api/users/{user_id}")
def deactivate_user(user_id: int) -> dict:
    """Suspend account (keeps history; user hidden from active lists)."""
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "user not found")
        if u.role == "admin":
            raise HTTPException(403, "cannot suspend admin account")
        u.active = False
        s.add(u)
        s.commit()
    hub.publish("users.changed")
    return {"ok": True}


@app.post("/api/users/{user_id}/purge")
def purge_user(user_id: int) -> dict:
    """Permanently delete user after clearing FK references."""
    from .auth.user_purge import purge_user_in_session

    with Session(engine) as s:
        try:
            purge_user_in_session(s, user_id)
        except ValueError as e:
            msg = str(e)
            if "not found" in msg:
                raise HTTPException(404, msg) from e
            raise HTTPException(403, msg) from e
        s.commit()
    hub.publish("users.changed")
    return {"ok": True}


def _org_department_read(row: OrgDepartment) -> OrgDepartmentRead:
    return OrgDepartmentRead(
        id=row.id,  # type: ignore[arg-type]
        code=row.code,
        name=row.name,
        sort_order=row.sort_order,
    )


@app.get("/api/departments", response_model=list[OrgDepartmentRead])
def list_departments() -> list[OrgDepartmentRead]:
    with Session(engine) as s:
        rows = list(
            s.exec(
                select(OrgDepartment).order_by(OrgDepartment.sort_order, OrgDepartment.name),
            ).all(),
        )
    return [_org_department_read(r) for r in rows]


@app.post("/api/departments", response_model=OrgDepartmentRead)
def create_department(payload: OrgDepartmentCreate) -> OrgDepartmentRead:
    from .org.departments_util import unique_department_code
    from .org.job_title_validation import normalize_english_label

    name = normalize_english_label(payload.name)
    with Session(engine) as s:
        code = unique_department_code(name, s)
        row = OrgDepartment(
            code=code,
            name=name,
            name_en=None,
            sort_order=payload.sort_order,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
    hub.publish("departments.changed")
    return _org_department_read(row)


@app.patch("/api/departments/{entry_id}", response_model=OrgDepartmentRead)
def update_department(entry_id: int, payload: OrgDepartmentUpdate) -> OrgDepartmentRead:
    with Session(engine) as s:
        row = s.get(OrgDepartment, entry_id)
        if not row:
            raise HTTPException(404, "department not found")
        from .org.job_title_validation import normalize_english_label

        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            data["name"] = normalize_english_label(data["name"])
        for k, v in data.items():
            setattr(row, k, v)
        s.add(row)
        s.commit()
        s.refresh(row)
    hub.publish("departments.changed")
    return _org_department_read(row)


_REQUEST_STATUSES_BLOCKING_DEPT_DELETE = (
    "pending",
    "assigned",
    "in_progress",
    "paused",
    "dnd",
)


def _department_delete_check(s: Session, row: OrgDepartment) -> OrgDeleteCheckRead:
    """Org departments are independent from staff (User) and catalog routing (Product)."""
    code = row.code
    job_titles = [
        JobTitleBlockerRef(id=jt.id, label=jt.label)  # type: ignore[arg-type]
        for jt in s.exec(select(JobTitle).where(JobTitle.department == code)).all()
    ]
    # Historical delivered/cancelled requests keep their department code for reports.
    blocked_by_requests = (
        s.exec(
            select(Request).where(
                Request.department == code,
                Request.status.in_(_REQUEST_STATUSES_BLOCKING_DEPT_DELETE),  # type: ignore[attr-defined]
            ),
        ).first()
        is not None
    )
    users = [
        BlockerUserRef(id=u.id, name=u.name)  # type: ignore[arg-type]
        for u in s.exec(select(User).where(User.department == code)).all()
    ]
    can_delete = not (job_titles or blocked_by_requests)
    return OrgDeleteCheckRead(
        can_delete=can_delete,
        job_titles=job_titles,
        users=users,
        products=[],
        blocked_by_products=False,
        blocked_by_requests=blocked_by_requests,
    )


@app.get("/api/departments/{entry_id}/delete-check", response_model=OrgDeleteCheckRead)
def department_delete_check(entry_id: int) -> OrgDeleteCheckRead:
    with Session(engine) as s:
        row = s.get(OrgDepartment, entry_id)
        if not row:
            raise HTTPException(404, "department not found")
        return _department_delete_check(s, row)


def _role_for_department_code(code: str) -> str:
    return {
        "housekeeping": "housekeeper",
        "maintenance": "maintenance",
        "front_office": "frontdesk",
        "bell_boy": "bellboy",
        "executive_management": "manager",
    }.get(code, "housekeeper")


def _job_title_department_map(s: Session) -> dict[str, str]:
    return {
        jt.label: jt.department
        for jt in s.exec(select(JobTitle)).all()
        if jt.department
    }


def _sync_users_departments_from_job_title_presets(
    s: Session,
    *,
    only_user_department: Optional[str] = None,
    only_job_title_department: Optional[str] = None,
) -> int:
    """Align User.department with each job-title preset department."""
    jt_map = _job_title_department_map(s)
    moved = 0
    for u in s.exec(select(User)).all():
        if not u.job_title:
            continue
        dept = jt_map.get(u.job_title)
        if not dept or u.department == dept:
            continue
        if only_user_department is not None and u.department != only_user_department:
            continue
        if only_job_title_department is not None and dept != only_job_title_department:
            continue
        u.department = dept
        if u.role != "admin":
            u.role = _role_for_department_code(dept)
        s.add(u)
        moved += 1
    return moved


def _sync_users_department_for_job_title(
    s: Session,
    *,
    job_title_label: str,
    department: str,
    only_if_user_department: Optional[str] = None,
) -> int:
    """When a job-title preset moves, staff with that title follow the same department."""
    moved = 0
    for u in s.exec(select(User).where(User.job_title == job_title_label)).all():
        if only_if_user_department is not None and u.department != only_if_user_department:
            continue
        if u.department == department:
            continue
        u.department = department
        if u.role != "admin":
            u.role = _role_for_department_code(department)
        s.add(u)
        moved += 1
    return moved


def _validate_relocate_target(s: Session, source_code: str, target_code: str) -> str:
    target = (target_code or "").strip()
    if not target:
        raise HTTPException(400, "target department required")
    if target == source_code:
        raise HTTPException(400, "target must differ from source department")
    if s.exec(select(OrgDepartment).where(OrgDepartment.code == target)).first() is None:
        raise HTTPException(400, "target department not found")
    return target


@app.post("/api/departments/{entry_id}/move-job-titles")
def move_department_job_titles(
    entry_id: int,
    payload: MoveDepartmentJobTitlesBody,
) -> dict:
    with Session(engine) as s:
        row = s.get(OrgDepartment, entry_id)
        if not row:
            raise HTTPException(404, "department not found")
        code = row.code
        target = _validate_relocate_target(s, code, payload.target_department)
        rows = list(s.exec(select(JobTitle).where(JobTitle.department == code)).all())
        moved_users = 0
        for jt in rows:
            label = jt.label
            jt.department = target
            s.add(jt)
            moved_users += _sync_users_department_for_job_title(
                s,
                job_title_label=label,
                department=target,
                only_if_user_department=code,
            )
        s.commit()
        moved = len(rows)
    hub.publish("departments.changed")
    hub.publish("users.changed")
    return {"ok": True, "moved": moved, "moved_users": moved_users}


@app.post("/api/departments/{entry_id}/sync-users-from-job-titles")
def sync_department_users_from_job_titles(entry_id: int) -> dict:
    """Align staff still on this department code with their job-title preset department."""
    with Session(engine) as s:
        row = s.get(OrgDepartment, entry_id)
        if not row:
            raise HTTPException(404, "department not found")
        moved = _sync_users_departments_from_job_title_presets(
            s,
            only_user_department=row.code,
        )
        s.commit()
    hub.publish("users.changed")
    return {"ok": True, "moved": moved}


@app.delete("/api/departments/{entry_id}")
def delete_department(entry_id: int) -> dict:
    with Session(engine) as s:
        row = s.get(OrgDepartment, entry_id)
        if not row:
            raise HTTPException(404, "department not found")
        check = _department_delete_check(s, row)
        if not check.can_delete:
            raise HTTPException(409, "department in use")
        s.delete(row)
        s.commit()
    hub.publish("departments.changed")
    return {"ok": True}


def _job_title_read(jt: JobTitle) -> JobTitleRead:
    return JobTitleRead(
        id=jt.id,  # type: ignore[arg-type]
        label=jt.label,
        department=jt.department,
        sort_order=jt.sort_order,
    )


def _validate_job_title_department(s: Session, code: str) -> str:
    dept = (code or "").strip()
    if not dept:
        raise HTTPException(400, "department required")
    if s.exec(select(OrgDepartment).where(OrgDepartment.code == dept)).first() is None:
        raise HTTPException(400, "unknown department")
    return dept


def _validate_user_job_title_department(
    s: Session,
    *,
    job_title: Optional[str],
    department: str,
) -> None:
    if not job_title or not str(job_title).strip():
        return
    label = str(job_title).strip()
    row = s.exec(select(JobTitle).where(JobTitle.label == label)).first()
    if not row:
        raise HTTPException(400, "job title not found")
    if row.department != department:
        raise HTTPException(400, "job title does not belong to department")


@app.get("/api/job-titles", response_model=list[JobTitleRead])
def list_job_titles(department: Optional[str] = None) -> list[JobTitleRead]:
    with Session(engine) as s:
        rows = list(
            s.exec(select(JobTitle).order_by(JobTitle.sort_order, JobTitle.label)).all(),
        )
    if department:
        from .catalog.product_assignees import job_title_departments_for_catalog

        allowed = set(job_title_departments_for_catalog(department))
        rows = [jt for jt in rows if jt.department in allowed]
    return [_job_title_read(jt) for jt in rows]


@app.post("/api/job-titles", response_model=JobTitleRead)
def create_job_title(payload: JobTitleCreate) -> JobTitleRead:
    from .org.job_title_validation import normalize_job_title_label

    label = normalize_job_title_label(payload.label)
    with Session(engine) as s:
        dept = _validate_job_title_department(s, payload.department)
        if s.exec(select(JobTitle).where(JobTitle.label == label)).first():
            raise HTTPException(409, "duplicate label")
        jt = JobTitle(
            label=label,
            department=dept,
            sort_order=payload.sort_order,
        )
        s.add(jt)
        s.commit()
        s.refresh(jt)
    return _job_title_read(jt)


@app.patch("/api/job-titles/{entry_id}", response_model=JobTitleRead)
def update_job_title(entry_id: int, payload: JobTitleUpdate) -> JobTitleRead:
    with Session(engine) as s:
        jt = s.get(JobTitle, entry_id)
        if not jt:
            raise HTTPException(404, "job title not found")
        data = payload.model_dump(exclude_unset=True)
        if "label" in data and data["label"] is not None:
            from .org.job_title_validation import normalize_job_title_label

            data["label"] = normalize_job_title_label(data["label"])
            dup = s.exec(
                select(JobTitle).where(
                    JobTitle.label == data["label"],
                    JobTitle.id != entry_id,  # type: ignore[arg-type]
                ),
            ).first()
            if dup:
                raise HTTPException(409, "duplicate label")
        if "department" in data and data["department"] is not None:
            data["department"] = _validate_job_title_department(s, data["department"])
        old_label = jt.label
        old_dept = jt.department
        for k, v in data.items():
            setattr(jt, k, v)
        new_label = jt.label
        moved_users = 0
        if (
            "label" in data
            and old_label
            and new_label
            and old_label != new_label
        ):
            for u in s.exec(select(User).where(User.job_title == old_label)).all():
                u.job_title = new_label
                s.add(u)
        if "department" in data and jt.department:
            moved_users = _sync_users_department_for_job_title(
                s,
                job_title_label=jt.label,
                department=jt.department,
                only_if_user_department=old_dept,
            )
        s.add(jt)
        s.commit()
        s.refresh(jt)
    if moved_users:
        hub.publish("users.changed")
    return _job_title_read(jt)


def _job_title_delete_check(s: Session, jt: JobTitle) -> OrgDeleteCheckRead:
    users = [
        BlockerUserRef(id=u.id, name=u.name)  # type: ignore[arg-type]
        for u in s.exec(select(User).where(User.job_title == jt.label)).all()
    ]
    return OrgDeleteCheckRead(
        can_delete=len(users) == 0,
        users=users,
    )


@app.get("/api/job-titles/{entry_id}/delete-check", response_model=OrgDeleteCheckRead)
def job_title_delete_check(entry_id: int) -> OrgDeleteCheckRead:
    with Session(engine) as s:
        jt = s.get(JobTitle, entry_id)
        if not jt:
            raise HTTPException(404, "job title not found")
        return _job_title_delete_check(s, jt)


@app.delete("/api/job-titles/{entry_id}")
def delete_job_title(entry_id: int) -> dict:
    with Session(engine) as s:
        jt = s.get(JobTitle, entry_id)
        if not jt:
            raise HTTPException(404, "job title not found")
        check = _job_title_delete_check(s, jt)
        if not check.can_delete:
            raise HTTPException(409, "job title in use by users")
        s.delete(jt)
        s.commit()
    return {"ok": True}


# ---------- Product categories ----------

def _sku_category_code(sku: str) -> Optional[str]:
    parts = sku.split("-")
    return parts[1].upper() if len(parts) >= 2 else None


def _product_category_read(row: ProductCategory, count: int) -> ProductCategoryRead:
    from .catalog.product_categories_i18n import resolved_category_names

    th, en = resolved_category_names(
        row.name,
        name_en=row.name_en,
        name_my=row.name_my,
        name_lo=row.name_lo,
    )
    return ProductCategoryRead(
        id=row.id,  # type: ignore[arg-type]
        code=row.code,
        department=row.department or "housekeeping",
        name=th,
        name_en=en,
        icon_emoji=row.icon_emoji,
        sort_order=row.sort_order,
        active=row.active,
        builtin=row.builtin,
        product_count=count,
    )


def _category_usage_map(s: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for sku in s.exec(select(Product.sku)).all():
        code = _sku_category_code(sku)
        if code:
            counts[code] = counts.get(code, 0) + 1
    return counts


def _assert_catalog_admin(actor_id: Optional[int], s: Session) -> None:
    if actor_id is None:
        raise HTTPException(403, "actor required")
    actor = s.get(User, actor_id)
    if not actor or not can_edit_catalog(effective_permissions(actor)):
        raise HTTPException(403, "not allowed to manage catalog")


def _assert_org_department_code(s: Session, department: str) -> str:
    code = (department or "").strip()
    if not code:
        raise HTTPException(400, "department required")
    if s.exec(select(OrgDepartment).where(OrgDepartment.code == code)).first() is None:
        raise HTTPException(400, "unknown department")
    return code


@app.get("/api/product-categories", response_model=list[ProductCategoryRead])
def list_product_categories(
    department: Optional[str] = Query(None, description="Filter by catalog department code"),
) -> list[ProductCategoryRead]:
    with Session(engine) as s:
        stmt = select(ProductCategory).order_by(
            ProductCategory.department,
            ProductCategory.sort_order,
            ProductCategory.code,
        )
        if department is not None and department.strip():
            dept = _assert_org_department_code(s, department)
            stmt = stmt.where(ProductCategory.department == dept)
        rows = list(s.exec(stmt).all())
        counts = _category_usage_map(s)
    return [_product_category_read(r, counts.get(r.code, 0)) for r in rows]


@app.post("/api/product-categories", response_model=ProductCategoryRead)
def create_product_category(payload: ProductCategoryCreate) -> ProductCategoryRead:
    code = payload.code.strip().upper()
    if not (3 <= len(code) <= 4) or not code.isalpha():
        raise HTTPException(400, "code must be 3-4 letters")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "name required")
    with Session(engine) as s:
        _assert_catalog_admin(payload.actor_id, s)
        dept = _assert_org_department_code(s, payload.department)
        if s.exec(select(ProductCategory).where(ProductCategory.code == code)).first():
            raise HTTPException(409, "duplicate code")
        row = ProductCategory(
            code=code,
            department=dept,
            name=name,
            name_en=(payload.name_en or "").strip() or None,
            icon_emoji=(payload.icon_emoji or "").strip() or None,
            sort_order=payload.sort_order,
            active=True,
            builtin=False,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        out = _product_category_read(row, 0)
    hub.publish("product-categories.changed")
    return out


@app.patch("/api/product-categories/{entry_id}", response_model=ProductCategoryRead)
def update_product_category(
    entry_id: int, payload: ProductCategoryUpdate,
) -> ProductCategoryRead:
    with Session(engine) as s:
        _assert_catalog_admin(payload.actor_id, s)
        row = s.get(ProductCategory, entry_id)
        if not row:
            raise HTTPException(404, "category not found")
        data = payload.model_dump(exclude_unset=True, exclude={"actor_id"})
        if "name" in data and data["name"] is not None:
            data["name"] = data["name"].strip()
            if not data["name"]:
                raise HTTPException(400, "name required")
        if "name_en" in data:
            data["name_en"] = (data["name_en"] or "").strip() or None
        if "icon_emoji" in data:
            data["icon_emoji"] = (data["icon_emoji"] or "").strip() or None
        for k, v in data.items():
            setattr(row, k, v)
        s.add(row)
        s.commit()
        s.refresh(row)
        counts = _category_usage_map(s)
        out = _product_category_read(row, counts.get(row.code, 0))
    hub.publish("product-categories.changed")
    return out


@app.delete("/api/product-categories/{entry_id}")
def delete_product_category(
    entry_id: int, actor_id: Optional[int] = Query(None),
) -> dict:
    with Session(engine) as s:
        _assert_catalog_admin(actor_id, s)
        row = s.get(ProductCategory, entry_id)
        if not row:
            raise HTTPException(404, "category not found")
        counts = _category_usage_map(s)
        used = counts.get(row.code, 0)
        if used > 0:
            raise HTTPException(
                409, f"category in use by {used} product(s); cannot delete",
            )
        s.delete(row)
        s.commit()
    hub.publish("product-categories.changed")
    return {"ok": True}


def _assert_admin(actor_id: Optional[int], s: Session) -> User:
    if actor_id is None:
        raise HTTPException(403, "actor required")
    actor = s.get(User, actor_id)
    if not actor or actor.role != "admin":
        raise HTTPException(403, "admin only")
    return actor


def _hotel_location_read(row: HotelLocation) -> HotelLocationRead:
    return HotelLocationRead(
        id=row.id,  # type: ignore[arg-type]
        code=row.code,
        label=row.label,
        label_en=row.label_en,
        icon_emoji=row.icon_emoji,
    )


@app.get("/api/hotel-locations", response_model=list[HotelLocationRead])
def list_hotel_locations(
    active_only: bool = Query(False, alias="active_only"),  # noqa: ARG001 — legacy param
) -> list[HotelLocationRead]:
    with Session(engine) as s:
        rows = list(
            s.exec(select(HotelLocation).order_by(HotelLocation.label)).all(),
        )
    return [_hotel_location_read(r) for r in rows]


@app.post("/api/hotel-locations", response_model=HotelLocationRead)
def create_hotel_location(payload: HotelLocationCreate) -> HotelLocationRead:
    from .hotel.hotel_location_emoji import infer_hotel_location_emoji
    from .hotel.hotel_location_validation import (
        assert_no_duplicate_labels,
        normalize_hotel_location_labels,
    )
    from .hotel.hotel_locations_util import unique_hotel_location_code

    th, en = normalize_hotel_location_labels(
        payload.label,
        payload.label_en,
    )
    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        assert_no_duplicate_labels(s, th, en)
        code = unique_hotel_location_code(th, s)
        emoji = (payload.icon_emoji or "").strip() or infer_hotel_location_emoji(code)
        row = HotelLocation(
            code=code,
            label=th,
            label_en=en,
            icon_emoji=emoji,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        out = _hotel_location_read(row)
    hub.publish("hotel-locations.changed")
    return out


@app.patch("/api/hotel-locations/{entry_id}", response_model=HotelLocationRead)
def update_hotel_location(
    entry_id: int, payload: HotelLocationUpdate,
) -> HotelLocationRead:
    from .hotel.hotel_location_validation import (
        assert_no_duplicate_labels,
        normalize_hotel_location_labels,
    )

    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        row = s.get(HotelLocation, entry_id)
        if not row:
            raise HTTPException(404, "location not found")
        data = payload.model_dump(exclude_unset=True, exclude={"actor_id"})
        if any(k in data for k in ("label", "label_en")):
            th, en = normalize_hotel_location_labels(
                data.get("label", row.label),
                data.get("label_en", row.label_en),
            )
            assert_no_duplicate_labels(s, th, en, exclude_id=entry_id)
            data["label"] = th
            data["label_en"] = en
        if "icon_emoji" in data and data["icon_emoji"] is not None:
            data["icon_emoji"] = data["icon_emoji"].strip() or None
        for k, v in data.items():
            setattr(row, k, v)
        s.add(row)
        s.commit()
        s.refresh(row)
        out = _hotel_location_read(row)
    hub.publish("hotel-locations.changed")
    return out


@app.delete("/api/hotel-locations/{entry_id}")
def delete_hotel_location(
    entry_id: int,
    actor_id: Optional[int] = Query(None),
) -> dict:
    with Session(engine) as s:
        _assert_admin(actor_id, s)
        row = s.get(HotelLocation, entry_id)
        if not row:
            raise HTTPException(404, "location not found")
        s.delete(row)
        s.commit()
    hub.publish("hotel-locations.changed")
    return {"ok": True}


def _guest_room_read(row: GuestRoom) -> GuestRoomRead:
    return GuestRoomRead(
        id=row.id,  # type: ignore[arg-type]
        number=row.number,
        building=row.building,
        floor=row.floor,
        type=row.room_type,
        view=row.view,
        area_sqm=row.area_sqm,
        bed=row.bed,
        connecting_peer=row.connecting_peer,
        active=row.active,
    )


def _normalize_connecting_peer(
    peer: str | None,
    *,
    room_number: str,
    session: Session,
    exclude_id: int | None = None,
) -> str | None:
    if peer is None:
        return None
    p = peer.strip()
    if not p:
        return None
    if p == room_number:
        raise HTTPException(400, "cannot connect room to itself")
    q = select(GuestRoom).where(GuestRoom.number == p)
    if exclude_id is not None:
        q = q.where(GuestRoom.id != exclude_id)  # type: ignore[arg-type]
    if not session.exec(q).first():
        raise HTTPException(400, "connecting room not found")
    return p


_ROOM_NUMBER_RE = re.compile(r"^[A-Za-z0-9-]{1,10}$")


def _normalize_guest_room_fields(
    *,
    number: str | None = None,
    building: int | None = None,
    floor: int | None = None,
    room_type: str | None = None,
    view: str | None = None,
    area_sqm: int | None = None,
    bed: str | None = None,
    connecting_peer: str | None = None,
    session: Session | None = None,
    exclude_id: int | None = None,
) -> tuple[str, int, int, str, str, int | None, str | None, str | None]:
    num = (number or "").strip()
    if not num:
        raise HTTPException(400, "room number required")
    if not _ROOM_NUMBER_RE.match(num):
        raise HTTPException(400, "invalid room number")
    if building is None or floor is None:
        if len(num) >= 2 and num[0].isdigit() and num[1].isdigit():
            b = int(num[0])
            f = int(num[1])
        else:
            raise HTTPException(400, "building and floor required")
    else:
        b = building
        f = floor
    rt = (room_type or "").strip() or "Superior"
    vw = (view or "").strip() or "garden"
    sqm: int | None = None
    if area_sqm is not None:
        if area_sqm < 15 or area_sqm > 200:
            raise HTTPException(400, "area must be 15–200 sqm")
        sqm = area_sqm
    bed_val: str | None = None
    if bed is not None:
        btrim = bed.strip()
        if btrim:
            bed_val = btrim
    if session is not None:
        assert_guest_room_against_options(
            session,
            building=b,
            floor=f,
            room_type=rt,
            view=vw,
            bed=bed_val,
            area_sqm=sqm,
        )
    peer_val: str | None = None
    if connecting_peer is not None and session is not None:
        peer_val = _normalize_connecting_peer(
            connecting_peer,
            room_number=num,
            session=session,
            exclude_id=exclude_id,
        )
    elif connecting_peer is not None and connecting_peer.strip():
        peer_val = connecting_peer.strip()
        if peer_val == num:
            raise HTTPException(400, "cannot connect room to itself")
    return num, b, f, rt, vw, sqm, bed_val, peer_val


@app.get("/api/room-options", response_model=list[RoomAttributeOptionRead])
def get_room_options() -> list[RoomAttributeOptionRead]:
    with Session(engine) as s:
        return [RoomAttributeOptionRead(**row) for row in list_room_options(s)]


@app.post("/api/room-options", response_model=RoomAttributeOptionRead)
def post_room_option(payload: RoomAttributeOptionCreate) -> RoomAttributeOptionRead:
    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        row = create_room_option(
            s,
            kind=payload.kind,
            code=payload.code,
            label_th=payload.label_th,
            label_en=payload.label_en,
            value_num=payload.value_num,
        )
    hub.publish("room-options.changed")
    return RoomAttributeOptionRead(**row)


@app.patch("/api/room-options/{option_id}", response_model=RoomAttributeOptionRead)
def patch_room_option(
    option_id: int, payload: RoomAttributeOptionUpdate,
) -> RoomAttributeOptionRead:
    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        data = payload.model_dump(exclude_unset=True, exclude={"actor_id"})
        row = update_room_option(
            s,
            option_id,
            code=data.get("code"),
            label_th=data.get("label_th"),
            label_en=data.get("label_en"),
            value_num=data.get("value_num"),
        )
    hub.publish("room-options.changed")
    return RoomAttributeOptionRead(**row)


@app.delete("/api/room-options/{option_id}")
def remove_room_option(
    option_id: int,
    actor_id: Optional[int] = Query(None),
) -> dict:
    with Session(engine) as s:
        _assert_admin(actor_id, s)
        delete_room_option(s, option_id)
    hub.publish("room-options.changed")
    return {"ok": True}


@app.get("/api/guest-rooms", response_model=list[GuestRoomRead])
def list_guest_rooms(
    active_only: bool = Query(False, alias="active_only"),
) -> list[GuestRoomRead]:
    with Session(engine) as s:
        q = select(GuestRoom).order_by(GuestRoom.building, GuestRoom.floor, GuestRoom.number)
        rows = list(s.exec(q).all())
    if active_only:
        rows = [r for r in rows if r.active]
    return [_guest_room_read(r) for r in rows]


@app.post("/api/guest-rooms", response_model=GuestRoomRead)
def create_guest_room(payload: GuestRoomCreate) -> GuestRoomRead:
    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        num, b, f, rt, vw, sqm, bed_val, peer_val = _normalize_guest_room_fields(
            number=payload.number,
            building=payload.building,
            floor=payload.floor,
            room_type=payload.type,
            view=payload.view,
            area_sqm=payload.area_sqm,
            bed=payload.bed,
            connecting_peer=payload.connecting_peer,
            session=s,
        )
        if s.exec(select(GuestRoom).where(GuestRoom.number == num)).first():
            raise HTTPException(409, "duplicate room number")
        row = GuestRoom(
            number=num,
            building=b,
            floor=f,
            room_type=rt,
            view=vw,
            area_sqm=sqm,
            bed=bed_val,
            connecting_peer=peer_val,
            active=payload.active,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        out = _guest_room_read(row)
    hub.publish("guest-rooms.changed")
    return out


@app.patch("/api/guest-rooms/{entry_id}", response_model=GuestRoomRead)
def update_guest_room(
    entry_id: int, payload: GuestRoomUpdate,
) -> GuestRoomRead:
    with Session(engine) as s:
        _assert_admin(payload.actor_id, s)
        row = s.get(GuestRoom, entry_id)
        if not row:
            raise HTTPException(404, "room not found")
        data = payload.model_dump(exclude_unset=True, exclude={"actor_id"})
        merged_number = data.get("number", row.number)
        merged_building = data.get("building", row.building)
        merged_floor = data.get("floor", row.floor)
        merged_type = data.get("type", row.room_type)
        merged_view = data.get("view", row.view)
        merged_sqm = data.get("area_sqm", row.area_sqm) if "area_sqm" in data else row.area_sqm
        merged_bed = data.get("bed", row.bed) if "bed" in data else row.bed
        merged_peer = (
            data.get("connecting_peer", row.connecting_peer)
            if "connecting_peer" in data
            else row.connecting_peer
        )
        num, b, f, rt, vw, sqm, bed_val, peer_val = _normalize_guest_room_fields(
            number=merged_number,
            building=merged_building,
            floor=merged_floor,
            room_type=merged_type,
            view=merged_view,
            area_sqm=merged_sqm,
            bed=merged_bed,
            connecting_peer=merged_peer,
            session=s,
            exclude_id=entry_id,
        )
        if num != row.number:
            dup = s.exec(
                select(GuestRoom).where(
                    GuestRoom.number == num,
                    GuestRoom.id != entry_id,  # type: ignore[arg-type]
                ),
            ).first()
            if dup:
                raise HTTPException(409, "duplicate room number")
        row.number = num
        row.building = b
        row.floor = f
        row.room_type = rt
        row.view = vw
        row.area_sqm = sqm
        row.bed = bed_val
        row.connecting_peer = peer_val
        if "active" in data:
            row.active = data["active"]
        s.add(row)
        s.commit()
        s.refresh(row)
        out = _guest_room_read(row)
    hub.publish("guest-rooms.changed")
    return out


@app.delete("/api/guest-rooms/{entry_id}")
def delete_guest_room(
    entry_id: int,
    actor_id: Optional[int] = Query(None),
) -> dict:
    with Session(engine) as s:
        _assert_admin(actor_id, s)
        row = s.get(GuestRoom, entry_id)
        if not row:
            raise HTTPException(404, "room not found")
        s.delete(row)
        s.commit()
    hub.publish("guest-rooms.changed")
    return {"ok": True}


# ---------------- Products / Stock ----------------

@app.get("/api/products", response_model=list[ProductRead])
def list_products() -> list[ProductRead]:
    with Session(engine) as s:
        return [product_to_read(p) for p in s.exec(select(Product).order_by(Product.sku)).all()]


@app.get("/api/products/stock-alerts", response_model=list[ProductRead])
def list_product_stock_alerts(
    department: Optional[str] = Query(default=None),
    limit: int = Query(default=32, ge=1, le=64),
) -> list[ProductRead]:
    with Session(engine) as s:
        return list_stock_alert_products(s, department=department, limit=limit)


@app.post("/api/products", response_model=ProductRead)
def create_product(payload: ProductCreate) -> ProductRead:
    with Session(engine) as s:
        if payload.actor_id is not None:
            actor = s.get(User, payload.actor_id)
            if not actor or not can_edit_catalog(effective_permissions(actor)):
                raise HTTPException(403, "not allowed to manage catalog")
        if s.exec(select(Product).where(Product.sku == payload.sku)).first():
            raise HTTPException(400, "SKU already exists")
        from .catalog.product_assignees import (
            assignee_job_titles_json_from_payload,
            validate_product_assignee_job_titles,
        )

        validate_product_assignee_job_titles(
            s,
            department=payload.department,
            labels=payload.assignee_job_titles,
        )
        data = payload.model_dump(exclude={"actor_id", "assignee_job_titles"})
        p = Product(
            **data,
            assignee_job_titles_json=assignee_job_titles_json_from_payload(
                payload.assignee_job_titles,
            ),
        )
        s.add(p)
        s.commit()
        s.refresh(p)
    hub.publish("products.changed")
    return product_to_read(p)


@app.patch("/api/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate) -> ProductRead:
    with Session(engine) as s:
        p = s.get(Product, product_id)
        if not p:
            raise HTTPException(404, "product not found")
        data = payload.model_dump(exclude_unset=True)
        actor_id = data.pop("actor_id", None)
        if actor_id is not None:
            actor = s.get(User, actor_id)
            if not actor:
                raise HTTPException(404, "actor not found")
            eperm = effective_permissions(actor)
            keys = set(data.keys())
            inv_only = keys <= {
                "on_hand",
                "reorder_at",
                "unit",
                "unit_en",
                "active",
                "icon_emoji",
            }
            if inv_only:
                if not can_adjust_inventory(eperm):
                    raise HTTPException(403, "not allowed to adjust inventory")
            else:
                if not can_edit_catalog(eperm):
                    raise HTTPException(403, "not allowed to manage catalog")
        if "sku" in data and data["sku"] is not None:
            new_sku = data["sku"].strip().upper()
            if not new_sku:
                raise HTTPException(400, "sku required")
            if new_sku != p.sku:
                dup = s.exec(
                    select(Product).where(
                        Product.sku == new_sku,
                        Product.id != product_id,  # type: ignore[arg-type]
                    ),
                ).first()
                if dup:
                    raise HTTPException(409, "duplicate sku")
            data["sku"] = new_sku
        from .catalog.product_assignees import (
            assignee_job_titles_json_from_payload,
            parse_product_assignee_job_titles,
            validate_product_assignee_job_titles,
        )

        titles_update = data.pop("assignee_job_titles", None)
        titles_in_payload = "assignee_job_titles" in payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(p, k, v)
        next_dept = str(p.department)
        if titles_in_payload:
            validate_product_assignee_job_titles(
                s,
                department=next_dept,
                labels=titles_update,
            )
            p.assignee_job_titles_json = assignee_job_titles_json_from_payload(titles_update)
        elif "department" in payload.model_dump(exclude_unset=True):
            validate_product_assignee_job_titles(
                s,
                department=next_dept,
                labels=parse_product_assignee_job_titles(p),
            )
        s.add(p)
        s.commit()
        s.refresh(p)
    hub.publish("products.changed")
    return product_to_read(p)


@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    actor_id: Optional[int] = Query(None),
) -> dict:
    """Hard-delete a catalog row (admin). Fails if referenced by request lines."""
    with Session(engine) as s:
        _assert_admin(actor_id, s)
        p = s.get(Product, product_id)
        if not p:
            raise HTTPException(404, "product not found")
        used = s.exec(
            select(RequestItem).where(RequestItem.product_id == product_id),
        ).first()
        if used:
            raise HTTPException(
                400,
                "product used in requests; deactivate instead",
            )
        for adj in s.exec(
            select(StockAdjustment).where(StockAdjustment.product_id == product_id),
        ).all():
            s.delete(adj)
        s.delete(p)
        s.commit()
    hub.publish("products.changed")
    return {"ok": True}


@app.post("/api/stock/check")
def check_stock_availability(payload: StockCheckRequest) -> dict[str, bool]:
    """Validate lines against on_hand minus qty on other open requests."""
    lines = [(line.product_id, max(1, line.qty)) for line in payload.items]
    if not lines:
        return {"ok": True}
    with Session(engine) as s:
        assert_stock_available_for_lines(
            s,
            lines,
            exclude_request_id=payload.exclude_request_id,
        )
    return {"ok": True}


@app.post("/api/products/{product_id}/adjust", response_model=ProductRead)
def adjust_stock(product_id: int, payload: StockAdjust) -> ProductRead:
    if payload.delta == 0:
        raise HTTPException(400, "delta cannot be zero")
    if payload.delta < 0:
        reason = (payload.reason or "").strip()
        if reason not in STOCK_WRITE_OFF_REASONS:
            raise HTTPException(400, "reason required for stock write-off")
    with Session(engine) as s:
        actor = None
        if payload.actor_id is not None:
            actor = s.get(User, payload.actor_id)
            if not actor or not can_adjust_inventory(effective_permissions(actor)):
                raise HTTPException(403, "not allowed to adjust stock")
        p = s.get(Product, product_id)
        if not p:
            raise HTTPException(404, "product not found")
        if p.is_service:
            raise HTTPException(400, "cannot adjust stock for service")
        before = p.on_hand or 0
        after = before + payload.delta
        if after < 0:
            raise HTTPException(400, "insufficient stock")
        reason = (payload.reason or "").strip() or "restock"
        p.on_hand = after
        s.add(p)
        s.add(
            StockAdjustment(
                product_id=p.id,
                product_sku=p.sku,
                product_name=p.name,
                delta=payload.delta,
                reason=reason,
                on_hand_before=before,
                on_hand_after=after,
                actor_id=actor.id if actor else None,
                actor_label=actor.name if actor else None,
            )
        )
        from .activity_log import log_activity

        sign = "+" if payload.delta > 0 else ""
        log_activity(
            s,
            action="stock.adjust",
            summary=f"{sign}{payload.delta} {p.name} ({reason})",
            actor=actor,
            entity_type="product",
            entity_id=p.id,
        )
        s.commit()
        s.refresh(p)
    hub.publish("products.changed")
    return product_to_read(p)


# ---------------- Requests ----------------

@app.get("/api/requests", response_model=list[RequestRead])
def list_requests(
    status: Optional[str] = None,
    scope: Optional[str] = Query(
        default=None,
        description="today | delivered_today | cancelled_today | overdue",
    ),
    on_date: Optional[str] = Query(
        default=None,
        description="YYYY-MM-DD — requests created on this calendar day (UTC)",
    ),
    department: Optional[str] = None,
    assignee_id: Optional[int] = None,
    q: Optional[str] = Query(default=None, description="search by room or code"),
    limit: int = 200,
    current: Optional[User] = Depends(get_optional_user),
) -> list[RequestRead]:
    from .hotel.hotel_time import hotel_local_now

    if current:
        list_scope = requests_list_scope_for_user(current)
        if list_scope.get("restrict"):
            on_date = hotel_local_now().strftime("%Y-%m-%d")
            dept = list_scope.get("department")
            if isinstance(dept, str):
                department = dept

    with Session(engine) as s:
        stmt = select(Request).order_by(Request.created_at.desc())
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        now = datetime.utcnow()

        if on_date:
            try:
                day_start = datetime.strptime(on_date.strip(), "%Y-%m-%d")
            except ValueError as e:
                raise HTTPException(400, "invalid on_date; use YYYY-MM-DD") from e
            day_end = day_start + timedelta(days=1)
            stmt = stmt.where(
                Request.created_at >= day_start,
                Request.created_at < day_end,
            )
        elif scope == "today":
            stmt = stmt.where(Request.created_at >= today_start)
        elif scope == "delivered_today":
            stmt = stmt.where(
                Request.status == "delivered",
                Request.delivered_at >= today_start,
            )
        elif scope == "cancelled_today":
            stmt = stmt.where(
                Request.status == "cancelled",
                Request.cancelled_at >= today_start,
            )
        elif scope == "overdue":
            stmt = stmt.where(
                Request.status.in_(["pending", "assigned", "in_progress"]),
            )
        elif status:
            if status == "active":
                stmt = stmt.where(Request.status.in_(
                    ["pending", "assigned", "in_progress", "paused", "dnd"]
                ))
            else:
                stmt = stmt.where(Request.status == status)
        if department:
            stmt = stmt.where(Request.department == department)
        if assignee_id is not None:
            stmt = stmt.where(Request.assignee_id == assignee_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where((Request.room.like(like)) | (Request.code.like(like)))
        stmt = stmt.limit(limit)
        rows = s.exec(stmt).all()
        if scope == "overdue":
            rows = [
                r for r in rows
                if (now - r.created_at).total_seconds() / 60 > r.response_minutes
            ]
        return requests_to_read(s, rows)


@app.get("/api/requests/{request_id}", response_model=RequestDetail)
def get_request(request_id: int) -> RequestDetail:
    with Session(engine) as s:
        r = s.get(Request, request_id)
        if not r:
            raise HTTPException(404, "request not found")
        return request_to_detail(s, r)


@app.post("/api/requests", response_model=RequestDetail)
def create_request(payload: RequestCreate) -> RequestDetail:
    with Session(engine) as s:
        # Normalize input: prefer structured lines, fall back to bare ids.
        lines: list[tuple[int, int, str | None]] = [
            (
                line.product_id,
                max(1, line.qty),
                (line.note or "").strip() or None,
            )
            for line in payload.items
        ]
        if not lines and payload.product_ids:
            lines = [(pid, 1, None) for pid in payload.product_ids]

        if lines:
            assert_stock_available_for_lines(
                s, [(pid, q) for pid, q, _ in lines],
            )
            product_ids = [pid for pid, _, _ in lines]
            qty_map = {pid: q for pid, q, _ in lines}
            note_map = {pid: n for pid, _, n in lines if n}
            dept = department_for_products(s, product_ids)
            items_text = items_text_for(s, product_ids, qty_map, note_map)
        else:
            dept = "housekeeping"
            items_text = (payload.custom_items or "Misc request").strip()
            if not items_text:
                raise HTTPException(400, "items required")

        creator = s.get(User, payload.created_by_id) if payload.created_by_id else None
        if creator:
            eff = effective_permissions(creator)
            if not eff.get("requests") and not can_use_quick_request(eff, creator.role):
                raise HTTPException(403, "cannot create requests")
        schedule_mode = payload.schedule_mode or "immediate"
        scheduled_at = to_naive_utc(payload.scheduled_at)
        room_str = str(payload.room).strip()

        line_product_ids = [pid for pid, _, _ in lines] if lines else []

        if (
            payload.auto_assign
            and not is_future_scheduled(schedule_mode, scheduled_at)
            and not has_assignable_staff(
                s,
                department=dept,
                room=room_str,
                product_ids=line_product_ids or None,
            )
        ):
            raise HTTPException(
                409,
                detail={
                    "code": "no_staff_available",
                    "department": dept,
                },
            )

        req = Request(
            code=next_code(s), room=room_str, department=dept,
            items_text=items_text, status="pending", priority=payload.priority,
            delivery_method=payload.delivery_method,
            response_minutes=current_response_budget_minutes(s),
            schedule_mode=schedule_mode,
            scheduled_at=scheduled_at,
            schedule_daily_time=payload.schedule_daily_time,
            created_by_id=creator.id if creator else None,
        )
        s.add(req)
        s.flush()

        for pid, q, note in lines:
            s.add(RequestItem(request_id=req.id, product_id=pid, qty=q, note=note))

        base_detail = (
            "Auto-assign • manual pick"
            if payload.preferred_assignee_id
            else ("Mode: auto-assign" if payload.auto_assign else "Mode: manual")
        )
        sched_detail = schedule_timeline_detail(
            schedule_mode, scheduled_at, payload.schedule_daily_time,
        )
        create_detail = f"{base_detail} · {sched_detail}" if sched_detail else base_detail

        add_event(
            s, req.id, kind="created", title="Request created",
            detail=create_detail,
            actor=creator, actor_label=creator.name if creator else None,
        )

        if payload.auto_assign:
            defer = is_future_scheduled(schedule_mode, scheduled_at)
            if defer:
                req.pending_auto_assign = True
                if payload.preferred_assignee_id is not None:
                    req.preferred_assignee_id = payload.preferred_assignee_id
            else:
                assigned = assign_request_now(
                    s,
                    req,
                    creator=creator,
                    preferred_id=payload.preferred_assignee_id,
                )
                if not assigned:
                    raise HTTPException(
                        409,
                        detail={
                            "code": "no_staff_available",
                            "department": dept,
                        },
                    )

        s.add(req)
        s.commit()
        s.refresh(req)
        detail = request_to_detail(s, req)
    publish_request_changed(detail)
    return detail


def _load(s: Session, request_id: int) -> Request:
    r = s.get(Request, request_id)
    if not r:
        raise HTTPException(404, "request not found")
    return r


def _save(s: Session, r: Request) -> None:
    r.updated_at = datetime.utcnow()
    s.add(r)


def _can_work_request_as_field(actor: User, r: Request) -> bool:
    """Assigned staff who may accept/start/deliver from My Queue."""
    if r.assignee_id is None or r.assignee_id != actor.id:
        return False
    if actor.role in ("housekeeper", "maintenance", "bellboy", "frontdesk"):
        return True
    return (
        actor.department == "housekeeping"
        and actor.role in ("hk_supervisor", "manager")
    )


def _assert_field_assignee(actor: Optional[User], r: Request) -> None:
    """Only the assigned field / HK leadership staff on this job."""
    if actor is None:
        raise HTTPException(403, "actor required")
    if not _can_work_request_as_field(actor, r):
        raise HTTPException(403, "only field staff on this request")


def _assert_report_dnd_allowed(actor: Optional[User], r: Request) -> None:
    """Only the assigned housekeeper or maintenance tech at the door may report DND."""
    _assert_field_assignee(actor, r)
    if r.status not in ("in_progress", "paused"):
        raise HTTPException(400, "start the job before reporting DND (in progress or paused at door)")


def _assert_resolve_dnd_allowed(actor: Optional[User]) -> None:
    """Front desk (or admin / manager) clears DND after calling the guest."""
    if actor is None:
        raise HTTPException(403, "actor required")
    if actor.role not in ("frontdesk", "admin", "manager"):
        raise HTTPException(403, "only front desk or supervisors can clear or defer DND")


def _assert_reassign_allowed(actor: Optional[User], r: Request) -> None:
    if actor is None:
        raise HTTPException(403, "actor required")
    if actor.role not in ("frontdesk", "admin", "manager", "hk_supervisor"):
        raise HTTPException(403, "not allowed to reassign")
    if r.status in ("delivered", "cancelled"):
        raise HTTPException(400, "cannot reassign closed request")
    if is_scheduled_hold(r):
        raise HTTPException(400, "cannot assign before scheduled delivery time")


def _assert_not_scheduled_hold(r: Request) -> None:
    if is_scheduled_hold(r):
        raise HTTPException(400, "cannot act before scheduled delivery time")


@app.post("/api/requests/{request_id}/reassign", response_model=RequestDetail)
def reassign_request(request_id: int, payload: RequestReassign) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        _assert_reassign_allowed(actor, r)
        pick = s.get(User, payload.assignee_id)
        if not pick or not eligible_assignee(r.department, pick, room=r.room, s=s):
            raise HTTPException(400, "invalid assignee")
        if r.assignee_id == pick.id:
            return request_to_detail(s, r)
        set_request_assignee(r, pick.id)
        if r.status == "pending":
            r.status = "assigned"
        _save(s, r)
        add_event(
            s,
            r.id,
            kind="reassigned",
            title=f"Reassigned to {pick.name}",
            actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


def _apply_schedule_change(
    s: Session,
    r: Request,
    *,
    schedule_mode: str,
    scheduled_at,
    schedule_daily_time: str | None,
    actor: User | None,
) -> None:
    if schedule_mode == "immediate":
        scheduled_at = None
    elif not scheduled_at or not is_future_scheduled(schedule_mode, scheduled_at):
        raise HTTPException(400, "scheduled time must be in the future")

    r.schedule_mode = schedule_mode
    r.scheduled_at = scheduled_at
    r.schedule_daily_time = schedule_daily_time
    r.assignee_id = None
    r.assignee_since = None
    r.status = "pending"

    sched_detail = schedule_timeline_detail(
        schedule_mode, scheduled_at, schedule_daily_time,
    )

    if schedule_mode == "immediate":
        r.pending_auto_assign = False
        assign_request_now(s, r, creator=actor, preferred_id=r.preferred_assignee_id)
    else:
        r.pending_auto_assign = True

    add_event(
        s,
        r.id,
        kind="note",
        title="Schedule updated",
        detail=sched_detail or "Scheduled delivery",
        actor=actor,
    )


@app.patch("/api/requests/{request_id}/hold", response_model=RequestDetail)
def update_request_hold(
    request_id: int,
    payload: RequestHoldUpdate,
) -> RequestDetail:
    """Edit a pre-scheduled request before its delivery time (not assignee)."""
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if actor is None:
            raise HTTPException(403, "actor required")
        if actor.role not in ("frontdesk", "admin", "manager", "hk_supervisor"):
            raise HTTPException(403, "not allowed to edit scheduled request")
        if r.status in ("delivered", "cancelled"):
            raise HTTPException(400, "cannot edit closed request")
        if not is_scheduled_hold(r):
            raise HTTPException(400, "can only edit before scheduled delivery time")

        detail_changes: list[str] = []

        if payload.room is not None:
            room = payload.room.strip()
            if not room:
                raise HTTPException(400, "room required")
            if room != r.room:
                r.room = room
                detail_changes.append("room")

        if payload.delivery_method is not None:
            method = payload.delivery_method.strip()
            if method != r.delivery_method:
                r.delivery_method = method
                detail_changes.append("delivery")

        if payload.items is not None:
            lines: list[tuple[int, int, str | None]] = [
                (
                    line.product_id,
                    max(1, line.qty),
                    (line.note or "").strip() or None,
                )
                for line in payload.items
            ]
            if not lines:
                raise HTTPException(400, "items required")
            existing = s.exec(
                select(RequestItem).where(RequestItem.request_id == r.id)
            ).all()
            current = sorted((ri.product_id, ri.qty, ri.note) for ri in existing)
            new = sorted(lines)
            if current != new:
                assert_stock_available_for_lines(
                    s,
                    [(pid, q) for pid, q, _ in lines],
                    exclude_request_id=r.id,
                )
                product_ids = [pid for pid, _, _ in lines]
                qty_map = {pid: q for pid, q, _ in lines}
                note_map = {pid: n for pid, _, n in lines if n}
                r.items_text = items_text_for(s, product_ids, qty_map, note_map)
                r.department = department_for_products(s, product_ids)
                for old in existing:
                    s.delete(old)
                for pid, q, note in lines:
                    s.add(
                        RequestItem(
                            request_id=r.id,
                            product_id=pid,
                            qty=q,
                            note=note,
                        )
                    )
                detail_changes.append("items")

        schedule_changed = False
        if payload.schedule_mode is not None:
            schedule_mode = payload.schedule_mode or "immediate"
            scheduled_at = to_naive_utc(payload.scheduled_at)
            if schedule_mode == "immediate":
                scheduled_at = None
            old_mode = r.schedule_mode or "immediate"
            old_at = to_naive_utc(r.scheduled_at)
            if schedule_mode != old_mode or scheduled_at != old_at:
                _apply_schedule_change(
                    s,
                    r,
                    schedule_mode=schedule_mode,
                    scheduled_at=scheduled_at,
                    schedule_daily_time=payload.schedule_daily_time,
                    actor=actor,
                )
                schedule_changed = True

        if not detail_changes and not schedule_changed:
            raise HTTPException(400, "no changes")

        if detail_changes:
            r.assignee_id = None
            r.assignee_since = None
            if r.status not in ("delivered", "cancelled"):
                r.status = "pending"
            add_event(
                s,
                r.id,
                kind="note",
                title="Request updated",
                detail=" · ".join(detail_changes),
                actor=actor,
            )

        _save(s, r)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.patch("/api/requests/{request_id}/schedule", response_model=RequestDetail)
def update_request_schedule(
    request_id: int,
    payload: RequestScheduleUpdate,
) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if actor is None:
            raise HTTPException(403, "actor required")
        if actor.role not in ("frontdesk", "admin", "manager", "hk_supervisor"):
            raise HTTPException(403, "not allowed to change schedule")
        if r.status in ("delivered", "cancelled"):
            raise HTTPException(400, "cannot change schedule on closed request")
        if not is_scheduled_hold(r):
            raise HTTPException(400, "schedule can only be changed before delivery time")

        schedule_mode = payload.schedule_mode or "immediate"
        scheduled_at = to_naive_utc(payload.scheduled_at)
        if schedule_mode == "immediate":
            scheduled_at = None
        _apply_schedule_change(
            s,
            r,
            schedule_mode=schedule_mode,
            scheduled_at=scheduled_at,
            schedule_daily_time=payload.schedule_daily_time,
            actor=actor,
        )
        _save(s, r)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/accept", response_model=RequestDetail)
def accept_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status not in ("pending", "assigned"):
            raise HTTPException(400, f"cannot accept from status {r.status}")
        _assert_not_scheduled_hold(r)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if actor:
            if not eligible_assignee(r.department, actor, room=r.room, s=s):
                raise HTTPException(400, "not eligible for this location")
            set_request_assignee(r, actor.id)
        r.status = "assigned"
        _save(s, r)
        add_event(s, r.id, kind="accepted", title="Accepted", actor=actor)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/start", response_model=RequestDetail)
def start_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status not in ("assigned", "paused"):
            raise HTTPException(400, f"cannot start from status {r.status}")
        _assert_not_scheduled_hold(r)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        was_paused = r.status == "paused"
        r.status = "in_progress"
        r.pause_reason = None
        _save(s, r)
        add_event(
            s, r.id,
            kind="resumed" if was_paused else "started",
            title="Resumed" if was_paused else "Started work",
            detail=None if was_paused else "Picked up items", actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/pause", response_model=RequestDetail)
def pause_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status != "in_progress":
            raise HTTPException(400, "only in_progress can be paused")
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        r.status = "paused"
        r.pause_reason = payload.reason or "Paused"
        _save(s, r)
        add_event(
            s, r.id, kind="paused", title="Paused",
            detail=payload.reason, actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/deliver", response_model=RequestDetail)
def deliver_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if r.status == "dnd":
            _assert_field_assignee(actor, r)
            deliver_detail = "Guest met at door"
        elif r.status in ("in_progress", "assigned"):
            deliver_detail = "Handed over at door"
        else:
            raise HTTPException(400, f"cannot deliver from status {r.status}")
        consume_stock(s, r)
        r.auto_cancel_at = None
        r.dnd_reason = None
        r.status = "delivered"
        r.delivered_at = datetime.utcnow()
        _save(s, r)
        add_event(
            s, r.id, kind="delivered", title="Delivered",
            detail=deliver_detail, actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    hub.publish("products.changed")
    return detail


@app.post("/api/requests/{request_id}/report-dnd", response_model=RequestDetail)
def report_dnd(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        _assert_report_dnd_allowed(actor, r)
        r.status = "dnd"
        r.dnd_reason = payload.reason or "DND sign on door"
        _save(s, r)
        add_event(
            s, r.id, kind="dnd_reported", title="DND reported",
            detail=r.dnd_reason, actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/dnd-clear", response_model=RequestDetail)
def clear_dnd(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status != "dnd":
            raise HTTPException(400, "request is not DND")
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        _assert_resolve_dnd_allowed(actor)
        r.status = "in_progress" if r.assignee_id else "pending"
        r.dnd_reason = None
        r.auto_cancel_at = None
        _save(s, r)
        add_event(s, r.id, kind="dnd_cleared", title="Guest called — proceed", actor=actor)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/dnd-defer", response_model=RequestDetail)
def defer_dnd(request_id: int, payload: RequestAction) -> RequestDetail:
    """Front desk: guest unreachable — keep DND until response-time deadline, then auto-cancel."""
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status != "dnd":
            raise HTTPException(400, "request is not DND")
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        _assert_resolve_dnd_allowed(actor)
        deadline = r.created_at + timedelta(minutes=r.response_minutes)
        r.status = "dnd"
        r.dnd_reason = "Guest unreachable"
        r.auto_cancel_at = deadline
        _save(s, r)
        add_event(
            s, r.id, kind="dnd_defer",
            title="Guest unreachable — waiting to auto-cancel",
            detail="cancel_reason:guest_unreachable",
            actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/rush", response_model=RequestDetail)
def rush_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        r.priority = "rush"
        _save(s, r)
        add_event(s, r.id, kind="rushed", title="Marked as Rush", actor=actor)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/unrush", response_model=RequestDetail)
def unrush_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if r.priority != "rush":
            detail = request_to_detail(s, r)
            return detail
        r.priority = "normal"
        _save(s, r)
        add_event(s, r.id, kind="unrushed", title="Rush removed", actor=actor)
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/cancel", response_model=RequestDetail)
def cancel_request(request_id: int, payload: RequestAction) -> RequestDetail:
    with Session(engine) as s:
        r = _load(s, request_id)
        if r.status == "dnd":
            raise HTTPException(
                400,
                "DND requests cannot be cancelled manually; mark guest unreachable and wait for auto-cancel",
            )
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        r.status = "cancelled"
        r.cancelled_at = datetime.utcnow()
        r.auto_cancel_at = None
        _save(s, r)
        add_event(
            s, r.id, kind="cancelled", title="Cancelled",
            detail=payload.reason, actor=actor,
        )
        s.commit()
        s.refresh(r)
        detail = request_to_detail(s, r)
    publish_request_changed(detail)
    return detail


@app.post("/api/requests/{request_id}/notes", response_model=NoteRead)
def add_note(request_id: int, payload: NoteCreate) -> NoteRead:
    with Session(engine) as s:
        r = _load(s, request_id)
        author = s.get(User, payload.author_id) if payload.author_id else None
        n = Note(
            request_id=r.id, author_id=author.id if author else None,
            body=payload.body.strip(),
        )
        s.add(n)
        s.commit()
        s.refresh(n)
        out = NoteRead(
            id=n.id, body=n.body, author_id=n.author_id,
            author_label=author.name if author else None,
            created_at=n.created_at,
        )
        publish_request_changed_by_id(s, request_id)
    return out


# ---------------- Dashboard + Reports ----------------

@app.get("/api/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    department: Optional[str] = Query(
        default=None,
        description="housekeeping | maintenance — narrow KPIs to one ops department",
    ),
) -> DashboardStats:
    _dashboard_depts = ("housekeeping", "maintenance", "front_office", "bell_boy")
    if department is not None and department not in _dashboard_depts:
        raise HTTPException(
            400,
            "department must be housekeeping, maintenance, front_office, or bell_boy",
        )

    with Session(engine) as s:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        def _req_where(*clauses):
            """AND Request.department when a dept scope is set."""
            stm = select(func.count(Request.id))
            for c in clauses:
                stm = stm.where(c)
            if department:
                stm = stm.where(Request.department == department)
            return stm

        today_count = s.exec(
            _req_where(Request.created_at >= today_start),
        ).one() or 0

        # Same status set as GET /api/requests?status=active (table on dashboard).
        in_progress = s.exec(
            _req_where(
                Request.status.in_(
                    ["pending", "assigned", "in_progress", "paused", "dnd"],
                ),
            ),
        ).one() or 0

        open_overdue = count_open_overdue_requests(s, department)
        low_stock = count_low_stock_products(s, department)

        delivered_today = s.exec(
            _req_where(
                Request.status == "delivered",
                Request.delivered_at >= today_start,
            ),
        ).one() or 0

        cancelled_today = s.exec(
            _req_where(
                Request.status == "cancelled",
                Request.cancelled_at >= today_start,
            ),
        ).one() or 0

    return DashboardStats(
        today_count=int(today_count),
        in_progress=int(in_progress),
        open_overdue=open_overdue,
        low_stock=low_stock,
        delivered_today=int(delivered_today),
        cancelled_today=int(cancelled_today),
    )


@app.get("/api/settings/time-alerts", response_model=TimeAlertSettings)
def get_time_alert_settings_route() -> TimeAlertSettings:
    with Session(engine) as s:
        warn, danger, breach = get_time_alert_settings(s)
    return TimeAlertSettings(warn=warn, danger=danger, breach=breach)


@app.patch("/api/settings/time-alerts", response_model=TimeAlertSettings)
def update_time_alert_settings(payload: TimeAlertSettingsUpdate) -> TimeAlertSettings:
    if not (payload.warn < payload.danger < payload.breach):
        raise HTTPException(400, "thresholds must satisfy warn < danger < breach")
    with Session(engine) as s:
        actor = s.get(User, payload.actor_id) if payload.actor_id else None
        if actor is None or actor.role != "admin":
            raise HTTPException(403, "only admin can update time alert settings")
        warn, danger, breach = save_time_alert_settings(
            s, payload.warn, payload.danger, payload.breach,
        )
    return TimeAlertSettings(warn=warn, danger=danger, breach=breach)


@app.post("/api/admin/seed-report-demo")
def admin_seed_report_demo(
    force: bool = Query(default=True),
    reset: bool = Query(default=True),
    current: User = Depends(get_current_user),
) -> dict:
    """Reset operational data and seed YTD demo requests for reports (admin only)."""
    if current.role != "admin":
        raise HTTPException(403, "only admin can seed report demo data")
    return seed_report_demo_data(force=force, reset=reset)


@app.post("/api/admin/clear-all-reports")
def admin_clear_all_reports(
    current: User = Depends(get_current_user),
) -> dict:
    """Delete all saved custom reports (preset catalog is defined in code)."""
    if current.role != "admin":
        raise HTTPException(403, "only admin can clear reports")
    from .reports.custom_reports import delete_all_custom_reports

    with Session(engine) as s:
        cleared = delete_all_custom_reports(s)
    return {"ok": True, "preset_count": 0, **cleared}


@app.get("/api/reports/summary", response_model=ReportSummary)
def reports_summary(days: int = 7) -> ReportSummary:
    with Session(engine) as s:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        delivered_today = s.exec(
            select(Request).where(
                (Request.status == "delivered") & (Request.delivered_at >= today_start)
            )
        ).all()
        durations = [
            (r.delivered_at - r.created_at).total_seconds() / 60
            for r in delivered_today if r.delivered_at
        ]
        avg_minutes = round(sum(durations) / len(durations), 1) if durations else 0.0

        all_today = s.exec(
            select(Request).where(Request.created_at >= today_start)
        ).all()
        overdue_today = sum(
            1 for r in all_today
            if (r.delivered_at or datetime.utcnow()) - r.created_at >
            timedelta(minutes=r.response_minutes)
        )

        by_dept = Counter(r.department for r in all_today)
        by_status = Counter(r.status for r in all_today)

        # top items in the last `days` days
        since = datetime.utcnow() - timedelta(days=days)
        rows = s.exec(
            select(RequestItem, Product, Request)
            .join(Product, Product.id == RequestItem.product_id)
            .join(Request, Request.id == RequestItem.request_id)
            .where(Request.created_at >= since)
        ).all()
        item_counter: Counter[str] = Counter()
        for ri, p, _r in rows:
            item_counter[p.name] += ri.qty
        top_items = [{"name": n, "qty": q} for n, q in item_counter.most_common(5)]

        # daily volume
        buckets: dict[str, int] = defaultdict(int)
        for r in s.exec(select(Request).where(Request.created_at >= since)).all():
            key = r.created_at.strftime("%m-%d")
            buckets[key] += 1
        daily_volume = [
            {"date": (datetime.utcnow() - timedelta(days=i)).strftime("%m-%d"),
             "count": buckets.get((datetime.utcnow() - timedelta(days=i)).strftime("%m-%d"), 0)}
            for i in reversed(range(days))
        ]

        stock_rows = s.exec(
            select(StockAdjustment)
            .where(StockAdjustment.created_at >= since)
            .order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
            .limit(50)
        ).all()
        stock_adjustments = [
            StockAdjustmentRead(
                id=row.id,
                product_sku=row.product_sku,
                product_name=row.product_name,
                delta=row.delta,
                reason=row.reason,
                on_hand_before=row.on_hand_before,
                on_hand_after=row.on_hand_after,
                actor_label=row.actor_label,
                created_at=row.created_at,
            )
            for row in stock_rows
        ]

    return ReportSummary(
        avg_delivery_minutes=avg_minutes,
        delivered_today=len(delivered_today),
        overdue_today=overdue_today,
        requests_by_dept=dict(by_dept),
        requests_by_status=dict(by_status),
        top_items=top_items,
        daily_volume=daily_volume,
        stock_adjustments=stock_adjustments,
    )


@app.get("/api/reports/presets", response_model=list[ReportPresetMeta])
def list_report_presets(
    _current: User = Depends(get_current_user),
) -> list[ReportPresetMeta]:
    from .reports.report_queries import PRESET_CATALOG

    return [ReportPresetMeta(**p) for p in PRESET_CATALOG]


@app.get("/api/reports/presets/{slug}/data", response_model=ReportPresetData)
def report_preset_data(
    slug: str,
    days: int = Query(default=7, ge=1, le=365),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    compare_date_from: Optional[str] = Query(None),
    compare_date_to: Optional[str] = Query(None),
    limit: int = Query(default=0, ge=0, le=2_000_000),
    shift: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    _current: User = Depends(get_current_user),
) -> ReportPresetData:
    from .reports import report_queries

    handler = report_queries.PRESET_HANDLERS.get(slug)
    if not handler:
        raise HTTPException(404, "unknown report")
    filters = report_queries.ReportFilters(
        department=department,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        action=action,
        date_from=date_from,
        date_to=date_to,
        compare_date_from=compare_date_from,
        compare_date_to=compare_date_to,
        limit=limit,
        shift=shift,
        stock_status=stock_status,
    )
    report_queries.validate_report_filter_ranges(filters)
    with Session(engine) as s:
        data = handler(s, days, filters)
    return ReportPresetData(slug=slug, data=data)


@app.post("/api/reports/export/pdf")
def export_report_pdf(
    doc: ExportDocumentModel,
    _current: User = Depends(get_current_user),
) -> Response:
    from .reports.report_export import ExportDocumentModel, build_pdf_bytes

    pdf_bytes = build_pdf_bytes(doc)
    safe = re.sub(r'[^\w\s-]', "", doc.title or "report")[:60].strip() or "report"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe}.pdf"',
        },
    )


@app.post("/api/reports/export/xlsx")
def export_report_xlsx(
    doc: ExportDocumentModel,
    _current: User = Depends(get_current_user),
) -> Response:
    from .reports.report_export import build_xlsx_bytes

    xlsx_bytes = build_xlsx_bytes(doc)
    safe = re.sub(r'[^\w\s-]', "", doc.title or "report")[:60].strip() or "report"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{safe}.xlsx"',
        },
    )


@app.get("/api/reports/custom", response_model=list[CustomReportRead])
def list_my_custom_reports(
    current: User = Depends(get_current_user),
) -> list[CustomReportRead]:
    from .reports.custom_reports import list_owned

    with Session(engine) as s:
        return list_owned(s, current.id)  # type: ignore[arg-type]


@app.get("/api/reports/custom/shared", response_model=list[CustomReportRead])
def list_shared_custom_reports(
    current: User = Depends(get_current_user),
) -> list[CustomReportRead]:
    from .reports.custom_reports import list_shared_with

    with Session(engine) as s:
        return list_shared_with(s, current.id)  # type: ignore[arg-type]


@app.get("/api/reports/custom/{report_id}", response_model=CustomReportRead)
def get_custom_report(
    report_id: int,
    current: User = Depends(get_current_user),
) -> CustomReportRead:
    from .reports.custom_reports import custom_report_to_read, get_report_for_user

    with Session(engine) as s:
        row = get_report_for_user(s, report_id, current.id)  # type: ignore[arg-type]
        owner = s.get(User, row.owner_user_id)
        share = None
        if row.owner_user_id != current.id:
            from .models import CustomReportShare

            sh = s.exec(
                select(CustomReportShare).where(
                    CustomReportShare.report_id == report_id,
                    CustomReportShare.shared_with_user_id == current.id,
                ),
            ).first()
            share = sh.permission if sh else None
        return custom_report_to_read(
            row,
            owner_name=owner.name if owner else None,
            shared_permission=share,
        )


@app.post("/api/reports/custom", response_model=CustomReportRead)
def create_custom_report(
    payload: CustomReportCreate,
    current: User = Depends(get_current_user),
) -> CustomReportRead:
    from .models import CustomReport
    from .reports.custom_reports import custom_report_to_read

    title = payload.title.strip()
    if not title:
        raise HTTPException(400, "title required")
    with Session(engine) as s:
        row = CustomReport(
            owner_user_id=current.id,  # type: ignore[arg-type]
            title=title,
            description=(payload.description or "").strip() or None,
            layout_json=payload.layout_json or "{}",
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        return custom_report_to_read(row)


@app.patch("/api/reports/custom/{report_id}", response_model=CustomReportRead)
def update_custom_report(
    report_id: int,
    payload: CustomReportUpdate,
    current: User = Depends(get_current_user),
) -> CustomReportRead:
    from .reports.custom_reports import custom_report_to_read, get_report_for_user

    with Session(engine) as s:
        row = get_report_for_user(s, report_id, current.id)  # type: ignore[arg-type]
        if row.owner_user_id != current.id:
            raise HTTPException(403, "only owner can edit")
        data = payload.model_dump(exclude_unset=True)
        if "title" in data and data["title"] is not None:
            t = data["title"].strip()
            if not t:
                raise HTTPException(400, "title required")
            row.title = t
        if "description" in data:
            row.description = (data["description"] or "").strip() or None
        if "layout_json" in data and data["layout_json"] is not None:
            row.layout_json = data["layout_json"]
        row.updated_at = datetime.utcnow()
        s.add(row)
        s.commit()
        s.refresh(row)
        return custom_report_to_read(row)


@app.delete("/api/reports/custom/{report_id}")
def delete_custom_report(
    report_id: int,
    current: User = Depends(get_current_user),
) -> dict:
    from .models import CustomReport, CustomReportShare
    from .reports.custom_reports import get_report_for_user

    with Session(engine) as s:
        row = get_report_for_user(s, report_id, current.id)  # type: ignore[arg-type]
        if row.owner_user_id != current.id:
            raise HTTPException(403, "only owner can delete")
        for sh in s.exec(
            select(CustomReportShare).where(CustomReportShare.report_id == report_id),
        ).all():
            s.delete(sh)
        s.delete(row)
        s.commit()
    return {"ok": True}


@app.get("/api/reports/custom/{report_id}/shares", response_model=CustomReportSharesRead)
def get_custom_report_shares(
    report_id: int,
    current: User = Depends(get_current_user),
) -> CustomReportSharesRead:
    from .reports.custom_reports import list_report_shares

    with Session(engine) as s:
        return list_report_shares(s, report_id, current.id)  # type: ignore[arg-type]


@app.patch("/api/reports/custom/{report_id}/sharing", response_model=CustomReportRead)
def update_custom_report_sharing(
    report_id: int,
    payload: CustomReportSharingUpdate,
    current: User = Depends(get_current_user),
) -> CustomReportRead:
    from .reports.custom_reports import update_report_sharing

    with Session(engine) as s:
        return update_report_sharing(
            s,
            report_id,
            current.id,  # type: ignore[arg-type]
            shared_with_all=payload.shared_with_all,
        )


@app.delete("/api/reports/custom/{report_id}/share/{target_user_id}")
def unshare_custom_report_user(
    report_id: int,
    target_user_id: int,
    current: User = Depends(get_current_user),
) -> dict:
    from .reports.custom_reports import unshare_user

    with Session(engine) as s:
        unshare_user(s, report_id, current.id, target_user_id)  # type: ignore[arg-type]
    return {"ok": True}


@app.post("/api/reports/custom/{report_id}/share")
def share_custom_report(
    report_id: int,
    payload: CustomReportShareCreate,
    current: User = Depends(get_current_user),
) -> dict:
    from .models import CustomReportShare
    from .reports.custom_reports import get_owned_report

    if payload.permission not in ("view", "duplicate"):
        raise HTTPException(400, "invalid permission")
    with Session(engine) as s:
        get_owned_report(s, report_id, current.id)  # type: ignore[arg-type]
        if payload.user_id == current.id:
            raise HTTPException(400, "cannot share with yourself")
        target = s.get(User, payload.user_id)
        if not target:
            raise HTTPException(404, "user not found")
        if not can_view_reports(effective_permissions(target)):
            raise HTTPException(400, "user cannot access reports")
        existing = s.exec(
            select(CustomReportShare).where(
                CustomReportShare.report_id == report_id,
                CustomReportShare.shared_with_user_id == payload.user_id,
            ),
        ).first()
        if existing:
            existing.permission = payload.permission
            s.add(existing)
        else:
            s.add(
                CustomReportShare(
                    report_id=report_id,
                    shared_with_user_id=payload.user_id,
                    shared_by_user_id=current.id,  # type: ignore[arg-type]
                    permission=payload.permission,
                ),
            )
        s.commit()
    return {"ok": True}


@app.post("/api/reports/custom/{report_id}/duplicate", response_model=CustomReportRead)
def duplicate_custom_report(
    report_id: int,
    current: User = Depends(get_current_user),
) -> CustomReportRead:
    from .reports.custom_reports import duplicate_report

    with Session(engine) as s:
        return duplicate_report(s, report_id, current.id)  # type: ignore[arg-type]


# ---------------- WebSocket ----------------

@app.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: Optional[str] = Query(default=None),
):
    from .auth.auth_util import get_user_for_token
    from .presence import set_user_presence

    user_id: int | None = None
    if token:
        user = get_user_for_token(token)
        if user and user.active and user.id is not None:
            user_id = user.id

    await hub.connect(ws, user_id=user_id)
    if user_id is not None:
        set_user_presence(user_id, "online")
        await asyncio.to_thread(retry_pending_assignments_when_staff_online)

    try:
        while True:
            raw = await ws.receive_text()
            if user_id is None:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "presence":
                status = str(msg.get("status") or "online")
                set_user_presence(user_id, status)
    except WebSocketDisconnect:
        disconnected = await hub.disconnect(ws)
        if disconnected is not None:
            sync_offline_user_assignments(disconnected)
    except Exception:
        disconnected = await hub.disconnect(ws)
        if disconnected is not None:
            sync_offline_user_assignments(disconnected)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "time": datetime.utcnow().isoformat()}
