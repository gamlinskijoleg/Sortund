import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Session } from "../../sessions/entities/session.entity";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true, length: 255 })
    email!: string;

    @Column({ name: "password_hash", length: 255 })
    passwordHash!: string;

    @OneToMany(() => Session, (session) => session.user, { cascade: true })
    sessions!: Session[];

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date;
}
