import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Liquidation { 
  @PrimaryGeneratedColumn("uuid")
  id?: string;

  @Column({ type: 'varchar', length: 88 })
  hash: string;

  @Column({ type: 'int'  })
  date: number;

  @Column({ type: 'varchar', length: 44 })
  signer: string; 
}