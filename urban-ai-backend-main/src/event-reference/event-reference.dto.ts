import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReferenceDecisionDto {
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class ImportReferenceCsvDto {
  /** `aprovado` (padrão: o CSV é curadoria humana) ou `candidato` (entra na fila de revisão). */
  @IsOptional() @IsString() @IsIn(['aprovado', 'candidato'])
  status?: 'aprovado' | 'candidato';
}
