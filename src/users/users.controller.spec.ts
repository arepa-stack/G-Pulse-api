import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
    let controller: UsersController;
    let service: UsersService;

    const mockUsersService = {
        findOne: jest.fn(),
        update: jest.fn(),
        getStats: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('updateProfile', () => {
        it('should call usersService.update with user id from request and update data', async () => {
            const mockReq = {
                user: { id: 'user-uuid-1' },
            };

            const updateData: any = {
                name: 'New Name',
                level: 'INTERMEDIATE',
            };

            const mockResponse = {
                id: 'user-uuid-1',
                googleId: 'google-oauth2-12345',
                name: 'New Name',
                level: 'INTERMEDIATE',
            };

            mockUsersService.update.mockResolvedValue(mockResponse);

            const result = await controller.updateProfile(mockReq, updateData);

            expect(service.update).toHaveBeenCalledWith('user-uuid-1', updateData);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getProfile', () => {
        it('should return user profile if found (without password)', async () => {
            const mockReq = { user: { id: 'user-uuid-1' } };
            const mockUser = {
                id: 'user-uuid-1',
                googleId: '123',
                password: 'hashed',
                email: 'a@b.com',
            } as any;
            mockUsersService.findOne.mockResolvedValue(mockUser);

            const result = await controller.getProfile(mockReq);
            expect(service.findOne).toHaveBeenCalledWith({ id: 'user-uuid-1' });
            expect(result).toEqual({
                id: 'user-uuid-1',
                googleId: '123',
                email: 'a@b.com',
            });
        });

        it('should throw NotFoundException if user does not exist', async () => {
            const mockReq = { user: { id: 'user-uuid-1' } };
            mockUsersService.findOne.mockResolvedValue(null);

            await expect(controller.getProfile(mockReq)).rejects.toThrow(NotFoundException);
        });
    });
});
