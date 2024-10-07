import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class MarginAccounts { 
  @PrimaryGeneratedColumn("uuid")
  id?: string;

  @Column({ type: 'varchar', length: 44 })
  address: string; 

  @Column({ type: 'varchar', length: 44 })
  exchange: string

  @Column({ type: 'boolean' })
  active: boolean; 
}