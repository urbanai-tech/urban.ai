// src/connect/connect.module.ts
import { Module }           from "@nestjs/common";
import { ConfigModule }     from "@nestjs/config";
import { TypeOrmModule }    from "@nestjs/typeorm";

import { ConnectService }    from "./connect.service";
import { ConnectController } from "./connect.controller";
import { List }              from "../entities/list.entity";
import { Address }           from "../entities/addresses.entity";
import { Event }             from "../entities/events.entity";
import { MapsModule }        from "../maps/maps.module";  
import { PropriedadeModule } from "src/propriedades/propriedade.module";
import { AirbnbModule } from "src/airbnb/airbnb.module";
import { EmailModule } from "src/email/email.module";
import { User } from "src/entities/user.entity";

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    PropriedadeModule,
    TypeOrmModule.forFeature([List, Address, Event, User]),
    MapsModule,  
    AirbnbModule
  ],
  controllers: [ConnectController],
  providers:   [ConnectService],
  exports:     [ConnectService],
})
export class ConnectModule {}
