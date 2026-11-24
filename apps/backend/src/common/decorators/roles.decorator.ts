import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../../users/entities/user.entity";

export const ROLES_KEY = "roles";

/** Restricts a route (or controller) to users with one of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
