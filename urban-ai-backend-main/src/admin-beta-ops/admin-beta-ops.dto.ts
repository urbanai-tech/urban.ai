import { IsIn, IsOptional } from 'class-validator';

export class SendBillingLinkDto {
  /** `auto` escolhe portal (assinatura viva) ou checkout (trial/plano) pelo estado atual. */
  @IsOptional()
  @IsIn(['auto', 'portal', 'checkout'])
  kind?: 'auto' | 'portal' | 'checkout';
}
