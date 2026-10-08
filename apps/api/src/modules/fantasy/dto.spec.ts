import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrepareJoinContestDto } from './dto';

describe('PrepareJoinContestDto', () => {
  it('accepts the real string IDs used by CrickX contests and teams', async () => {
    const dto = plainToInstance(PrepareJoinContestDto, {
      contestId: 'contest_71318',
      fantasyTeamId: 'team_user_71318',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects blank contest or team IDs', async () => {
    const dto = plainToInstance(PrepareJoinContestDto, {
      contestId: '',
      fantasyTeamId: '',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(['contestId', 'fantasyTeamId']);
  });
});
