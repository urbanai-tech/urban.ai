import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './events.entity';
import { User } from './user.entity';

/**
 * Registro de "este anfitrião já foi avisado deste evento" (push de evento relevante).
 * A chave única (user_id, event_id) é a idempotência: duas réplicas ou duas execuções do job nunca
 * avisam o mesmo anfitrião duas vezes. `sent_on` (dia de São Paulo) e `property_id` sustentam os
 * limites diários por imóvel e por anfitrião.
 */
@Entity('event_alert_dispatches')
@Index('UQ_event_alert_dispatches_user_event', ['userId', 'eventId'], { unique: true })
@Index('IDX_event_alert_dispatches_user_day', ['userId', 'sentOn'])
@Index('IDX_event_alert_dispatches_property_day', ['propertyId', 'sentOn'])
export class EventAlertDispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'event_id', type: 'varchar', length: 36 })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  /** Imóvel (addresses.id) pelo qual o anfitrião foi avisado: o mais próximo do evento. */
  @Column({ name: 'property_id', type: 'varchar', length: 36 })
  propertyId: string;

  /** Dia (São Paulo, `YYYY-MM-DD`) em que o aviso foi gerado; base dos limites diários. */
  @Column({ name: 'sent_on', type: 'varchar', length: 10 })
  sentOn: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
