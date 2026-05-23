import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export type CommunicationChannel = 'email' | 'push' | 'in_app';
export type CommunicationStatus = 'sent' | 'failed' | 'skipped';

@Entity('communication_events')
@Index('IDX_communication_events_created', ['createdAt'])
@Index('IDX_communication_events_channel_status', ['channel', 'status', 'createdAt'])
@Index('IDX_communication_events_user_created', ['userId', 'createdAt'])
@Index('IDX_communication_events_kind_created', ['kind', 'createdAt'])
export class CommunicationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'varchar', length: 24 })
  channel: CommunicationChannel;

  @Column({ type: 'varchar', length: 24 })
  status: CommunicationStatus;

  @Column({ type: 'varchar', length: 96, nullable: true })
  kind?: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 120, nullable: true })
  templateName?: string | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 254, nullable: true })
  recipientEmail?: string | null;

  @Column({ name: 'recipient_device_id', type: 'varchar', length: 64, nullable: true })
  recipientDeviceId?: string | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  subject?: string | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  provider?: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 160, nullable: true })
  providerMessageId?: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ name: 'metadata_json', type: 'text', nullable: true })
  metadataJson?: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 120, nullable: true })
  correlationId?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
