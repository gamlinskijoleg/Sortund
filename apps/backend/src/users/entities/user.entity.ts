import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Session } from "../../sessions/entities/session.entity";

export enum UserRole {
    User = "user",
    Admin = "admin",
}

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true, length: 255 })
    email!: string;

    @Column({ name: "password_hash", length: 255 })
    passwordHash!: string;

    @Column({ type: "varchar", length: 16, default: UserRole.User })
    role!: UserRole;

    /** Number of (non-cached) analyses the user may run per calendar month. */
    @Column({ name: "monthly_analysis_limit", type: "int", default: 100 })
    monthlyAnalysisLimit!: number;

    @Column({ name: "is_blocked", type: "boolean", default: false })
    isBlocked!: boolean;

    /** Expo push token of the user's latest device, used for "analysis finished" notifications. */
    @Column({ name: "push_token", type: "varchar", length: 255, nullable: true })
    pushToken!: string | null;

    @OneToMany(() => Session, (session) => session.user, { cascade: true })
    sessions!: Session[];

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}
