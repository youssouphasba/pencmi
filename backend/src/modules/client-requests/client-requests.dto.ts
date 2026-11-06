import { IsIn, Matches } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

import {
  CLIENT_REQUEST_TYPES,
  ClientRequestType,
} from '../../common/constants/client-requests';
export { CLIENT_REQUEST_TYPES } from '../../common/constants/client-requests';
export type { ClientRequestType } from '../../common/constants/client-requests';

export class ClientRequestQueryDto extends PaginationDto {
  @IsIn(CLIENT_REQUEST_TYPES)
  type: ClientRequestType;
}

export class ClientRequestParamsDto {
  @IsIn(CLIENT_REQUEST_TYPES)
  type: ClientRequestType;

  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}
