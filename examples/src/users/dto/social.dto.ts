import { IsIn, IsString } from '@bunner/core';

export class SocialDto {
  @IsIn(['twitter', 'github', 'linkedin'])
  platform: string;

  @IsString()
  url: string;
}
