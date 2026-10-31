import { Column, Entity, PrimaryColumn } from 'typeorm';

export type CollectorAlertKind = 'expected' | 'zero_yield' | 'never_delivered';

/**
 * Estado persistido dos alertas de fonte de eventos (antes só em memória, perdido a cada deploy).
 *  - `expected`: fonte configurada que esperamos receber; `firstExpectedAt` marca desde quando
 *    (base do "nunca entregou após X dias");
 *  - `zero_yield` / `never_delivered`: `lastAlertAt` é o último envio, para respeitar o intervalo
 *    de realerta mesmo após reinício.
 */
@Entity('collector_alert_state')
export class CollectorAlertState {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  source: string;

  @PrimaryColumn({ type: 'varchar', length: 24 })
  kind: CollectorAlertKind;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  firstExpectedAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  lastAlertAt: Date | null;

  @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
