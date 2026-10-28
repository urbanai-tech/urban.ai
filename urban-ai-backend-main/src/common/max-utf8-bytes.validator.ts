import { ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Limita o tamanho em BYTES UTF-8 (não em caracteres). Usado nas senhas: o bcrypt
 * só considera os primeiros 72 bytes, e um caractere acentuado ou emoji ocupa de
 * 2 a 4 bytes, então `@MaxLength(128)` sozinho não garante isso.
 * Valores que não são string passam (o `@IsString()` do campo cuida deles).
 */
export function MaxUtf8Bytes(max: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxUtf8Bytes',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value !== 'string' || Buffer.byteLength(value, 'utf8') <= max;
        },
        defaultMessage() {
          return `${propertyName} pode ter no máximo ${max} bytes.`;
        },
      },
    });
  };
}
