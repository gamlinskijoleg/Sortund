import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Triggers the LocalStrategy (email + password validation). */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {}
