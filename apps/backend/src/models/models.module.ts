import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModelVersion } from "./entities/model-version.entity";
import { ModelsService } from "./models.service";
import { Correction } from "../corrections/entities/correction.entity";
import { TrackAnalysis } from "../analysis/entities/track-analysis.entity";

@Module({
    imports: [TypeOrmModule.forFeature([ModelVersion, Correction, TrackAnalysis])],
    providers: [ModelsService],
    exports: [ModelsService],
})
export class ModelsModule {}
