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
        it('should call usersService.update with Google ID from request and update data', async () => {
            const mockReq = {
                user: { uid: 'google-oauth2-12345' },
            };

            const updateData: any = {
                name: 'New Name',
                level: 'INTERMEDIATE',
            };

            const mockResponse = {
                id: 'user-id-1',
                googleId: 'google-oauth2-12345',
                name: 'New Name',
                level: 'INTERMEDIATE',
            };

            mockUsersService.update.mockResolvedValue(mockResponse);

            const result = await controller.updateProfile(mockReq, updateData);

            expect(service.update).toHaveBeenCalledWith('google-oauth2-12345', updateData);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getProfile', () => {
        it('should return user profile if found', async () => {
            const mockReq = { user: { uid: '123' } };
            const mockUser = { id: 'user1', googleId: '123' };
            mockUsersService.findOne.mockResolvedValue(mockUser);

            const result = await controller.getProfile(mockReq);
            expect(service.findOne).toHaveBeenCalledWith({ googleId: '123' });
            expect(result).toEqual(mockUser);
        });

        it('should throw NotFoundException if user does not exist', async () => {
            const mockReq = { user: { uid: '123' } };
            mockUsersService.findOne.mockResolvedValue(null);

            await expect(controller.getProfile(mockReq)).rejects.toThrow(NotFoundException);
        });
    });
});
