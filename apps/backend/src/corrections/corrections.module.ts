import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Correction } from "./entities/correction.entity";
import { CorrectionsService } from "./corrections.service";
import { CorrectionsController } from "./corrections.controller";
import { TrackAnalysis } from "../analysis/entities/track-analysis.entity";
import { ModelsModule } from "../models/models.module";

@Module({
    imports: [TypeOrmModule.forFeature([Correction, TrackAnalysis]), ModelsModule],
    controllers: [CorrectionsController],
    providers: [CorrectionsService],
    exports: [CorrectionsService],
})
export class CorrectionsModule {}
