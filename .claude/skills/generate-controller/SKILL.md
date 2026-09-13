---
name: generate-controller
description: Scaffold the controller layer (src/features/{name}/{name}.controller.ts) — CRUD routes with ZodValidationPipe, CurrentUser, and Swagger decorators driven by data/message files, plural route path. Use when asked to create/add a controller, routes, or REST endpoints for a feature in this NestJS tutoring backend.
---

# Generate Controller

Create `src/features/foo/foo.controller.ts`, mirroring `class.controller.ts`.

## Prerequisites
- `FooService` exists (see `generate-service`).
- DTOs + schemas exist under `@packages/entities/foo`.
- Swagger data/messages exist (see the Swagger section) under `src/data/swaggers/`.

## Shape
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBody, ApiResponse as SwaggerResponse,
  ApiBearerAuth, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';
import { ZodValidationPipe } from '@packages/pipes';
import { CurrentUser } from '@packages/decorators';
import { createFooSchema, type CreateFooDto, getFoosQuerySchema, type GetFoosQueryDto } from '@packages/entities/foo';
import { FooService } from './foo.service';
import { FOO_SWAGGER_MESSAGES } from 'src/data/swaggers/messages';
import { FOO_SWAGGERS_DATA } from 'src/data/swaggers/data/foo.swagger';

@ApiTags('Foos')
@ApiBearerAuth('access-token')
@Controller('foos') // plural route
export class FooController {
  constructor(private readonly fooService: FooService) {}
  // POST / , GET / , GET /:id , DELETE /:id
}
```

## Routes (mirror class.controller.ts)
- `@Post()` `@HttpCode(StatusCodes.CREATED)` → body via
  `new ZodValidationPipe<CreateFooDto>(createFooSchema)` + `@CurrentUser() user`; call
  `this.fooService.createFooService({ data: dto, userId: user.id })`.
- `@Get('')` `@HttpCode(StatusCodes.OK)` → query via
  `new ZodValidationPipe<GetFoosQueryDto>(getFoosQuerySchema)` + `@CurrentUser() user`;
  `this.fooService.getFoosService({ userId: user?.id, query })`.
- `@Get('/:id')` → `@CurrentUser() user`, `@Param('id') id`,
  `this.fooService.getFooService({ userId: user?.id, id })`.
- `@Delete(':id')` → same params, `this.fooService.delFooService({ userId: user?.id, id })`.

Get the current user with `@CurrentUser() user: Record<string, string>` (from
`@packages/decorators`) and read `user.id` — do NOT use the old `@User` decorator.

For a **child resource** owned via a parent (e.g. `schedule`), the routes differ: add
`@Post('bulk')` (bulk create), `@Get('class/:classId')` (list by parent) instead of a global
paginated `@Get()`, and `@Patch(':id')` for partial update. Declare the specific
`bulk` / `class/:classId` routes before `:id`. See `schedule.controller.ts`.

## Swagger (data-driven)
Swagger content lives in dedicated files, not inline strings:
- Messages: `src/data/swaggers/messages/foo.msg.ts` (re-export from `messages/index.ts`),
  used as `FOO_SWAGGER_MESSAGES.GET_FOOS_SUCCESSFULLY`.
- Request/response shapes: `src/data/swaggers/data/foo.swagger.ts` exporting
  `FOO_SWAGGERS_DATA` with `CREATE_FOO_SCHEMA` (`@ApiBody({ schema: ... })`),
  `GET_FOOS_SCHEMA` (array of `@ApiQuery(...)` objects), and `GET_DETAIL_FOO` / detail params.
Decorate each route with `@ApiOperation`, `@ApiBody`/`@ApiQuery`/`@ApiParam`, and
`@ApiResponse as SwaggerResponse` referencing those constants.

## Rules
- Controllers hold no business logic — delegate everything to the service, passing `user.id`.
- Import `ZodValidationPipe` from `@packages/pipes`, DTOs/schemas from `@packages/entities/foo`.
- Routes are protected by the global `JwtAuthGuard`. Add `@Public()` from `@packages/decorators`
  only for intentionally open endpoints, `@Roles('ADMIN')` (from `@packages/decorators`, paired
  with `RolesGuard` from `@packages/guards`) for admin-only ones — there is no `@Admin()`
  decorator in this repo.
