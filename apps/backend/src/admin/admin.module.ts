import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AnalysisJob } from "../analysis/entities/analysis-job.entity";
import { UsersModule } from "../users/users.module";
import { SessionsModule } from "../sessions/sessions.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { CorrectionsModule } from "../corrections/corrections.module";
import { ModelsModule } from "../models/models.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([AnalysisJob]),
        UsersModule,
        SessionsModule,
        AnalysisModule,
        CorrectionsModule,
        ModelsModule,
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
