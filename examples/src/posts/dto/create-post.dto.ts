import { IsString } from '@bunner/core';
import { ApiProperty } from '@bunner/scalar';

export class CreatePostDto {
  @ApiProperty({ description: 'Title of the post', example: 'Hello World' })
  @(IsString() as PropertyDecorator)
  title: string;

  @ApiProperty({ description: 'Content of the post', example: 'This is a content' })
  @(IsString() as PropertyDecorator)
  content: string;
}
