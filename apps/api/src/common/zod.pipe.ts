import { type PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Validate a request body against a shared Zod schema at the HTTP boundary (Plan §6). */
export class ZodBody<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return result.data;
  }
}
