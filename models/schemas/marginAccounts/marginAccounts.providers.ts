import { DataSource } from 'typeorm'; 
import { MarginAccounts } from './marginAccounts.entity';

export const marginAccountsProviders = [
  {
    provide: 'MARGIN_ACCOUNTS_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(MarginAccounts),
    inject: ['DATA_SOURCE'],
  },
];