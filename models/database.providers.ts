import { DataSource } from 'typeorm';

export const databaseProviders = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: 5432,
        password: process.env.POSTGRES_PASSWORD,
        username: process.env.POSTGRES_USERNAME,
        entities: [
           __dirname + '/**/*.entity.ts'
        ],
        database: process.env.POSTGRES_DATABASE,
        synchronize: true,
        logging: true,
      });

      return dataSource.initialize();
    },
  },
];

