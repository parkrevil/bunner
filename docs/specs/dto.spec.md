## 📦 DTO (Data Transfer Object)

DTO라는 개념 자체는 사용되겠지만 용어가 모호함. 사용자에게 프레임워크 권장 용어를 어필할 필요가 있음

- **HTTP**: Body, Query, Params, Headers, Response
  - CreateUserBody, CreateUserResponse, ListQuery, UserIdParams
- **gPRC**: Request, Response
  - CreateUserRequest, CreateUserResponse
- **WS**: Payload, Response, Message
  - CreateUserPayload, CreateUserResponse, StartMaintenanceMessage
- **Queue**: Message, Event
  - CreateUserMessage, CreateUserEvent
- **TCP, UDP, QUIC**: Packet
  - CreateUserPacket
