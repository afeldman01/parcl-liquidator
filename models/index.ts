import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { User } from "./schemas/users/user.schema";
import autoPopulate from 'mongoose-autopopulate'
import { UserSchema } from './schemas/users/user.schema' 
import { Module } from "@nestjs/common"; 
import { Url, UrlSchema } from "./schemas/urls/url.schema";

const ImportExports = [
    ConfigModule, 
    MongooseModule.forFeatureAsync([
        {
            name: User.name,
            useFactory: () => {
                const schema = UserSchema;
                schema.plugin(autoPopulate);
                return schema;
            }
        }
    ]), 
    MongooseModule.forFeatureAsync([
        {
            name: Url.name,
            useFactory: () => {
                const schema = UrlSchema;
                schema.plugin(autoPopulate);
                return schema;
            }
        }
    ]), 
    MongooseModule.forFeature([
        { name: User.name, schema: UserSchema }, 
    ]),
    MongooseModule.forFeature([
        { name: Url.name, schema: UrlSchema }, 
    ])
]   

@Module({
    exports: ImportExports,
    imports: ImportExports
})
export class ModelsModule {}