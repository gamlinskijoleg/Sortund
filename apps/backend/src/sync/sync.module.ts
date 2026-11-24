import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LibraryItem } from "./entities/library-item.entity";
import { SyncedPlaylist } from "./entities/synced-playlist.entity";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";

@Module({
    imports: [TypeOrmModule.forFeature([LibraryItem, SyncedPlaylist])],
    controllers: [SyncController],
    providers: [SyncService],
})
export class SyncModule {}
