export interface User {
  id: number;
  name: string;
}

export interface ComplexCreateResponse<TData> {
  message: string;
  data: TData;
  isNameString: boolean;
  isAgeNumber: boolean;
  isAddressInstance: boolean;
  isSocialInstance: boolean;
}
