import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>
    ) {}

    async create(email: string, password: string): Promise<User> {
        const existing = await this.usersRepository.findOne({
            where: { email },
        });
        if (existing) {
            throw new ConflictException("Email is already registered");
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = this.usersRepository.create({ email, passwordHash });
        return this.usersRepository.save(user);
    }

    findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }
}
