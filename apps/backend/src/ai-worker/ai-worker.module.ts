import { Global, Module } from "@nestjs/common";
import { AiWorkerClient } from "./ai-worker.client";

@Global()
@Module({
    providers: [AiWorkerClient],
    exports: [AiWorkerClient],
})
export class AiWorkerModule {}
