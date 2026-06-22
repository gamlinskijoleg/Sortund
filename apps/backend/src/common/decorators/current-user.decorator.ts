import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** Extracts the authenticated user injected by Passport into request.user. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    return request.user;
});
