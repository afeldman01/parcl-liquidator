import { DataSource } from 'typeorm'; 
import { Liquidation } from './liquidation.entity';

export const liquidationProviders = [
  {
    provide: 'LIQUIDATION_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Liquidation),
    inject: ['DATA_SOURCE'],
  },
];