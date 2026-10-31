import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Address } from './addresses.entity';
import { PropertyOwner } from './property-owner.entity';

/**
 * Vínculo proprietário -> imóvel. Um imóvel tem no máximo UM proprietário
 * (`UQ_property_owner_properties_address`); um proprietário pode ter vários imóveis.
 */
@Entity('property_owner_properties')
@Index('UQ_property_owner_properties_address', ['addressId'], { unique: true })
@Index('IDX_property_owner_properties_owner', ['ownerId'])
export class PropertyOwnerProperty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'varchar', length: 36 })
  ownerId: string;

  @ManyToOne(() => PropertyOwner, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: PropertyOwner;

  @Column({ name: 'address_id', type: 'varchar', length: 36 })
  addressId: string;

  @ManyToOne(() => Address, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
