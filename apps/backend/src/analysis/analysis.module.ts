import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalysisJob } from "./entities/analysis-job.entity";
import { TrackAnalysis } from "./entities/track-analysis.entity";
import { AnalysisService } from "./analysis.service";
import { AnalysisProcessor } from "./analysis.processor";
import { AnalysisController } from "./analysis.controller";
import { PushService } from "./push.service";
import { UsersModule } from "../users/users.module";
import { ModelsModule } from "../models/models.module";

@Module({
    imports: [TypeOrmModule.forFeature([AnalysisJob, TrackAnalysis]), UsersModule, ModelsModule],
    controllers: [AnalysisController],
    providers: [AnalysisService, AnalysisProcessor, PushService],
    exports: [AnalysisService],
})
export class AnalysisModule {}
