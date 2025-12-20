import { parseSync } from 'oxc-parser';

const code = `
class Test {
  constructor(public p: Promise<User>) {}
}
`;

const result = parseSync('test.ts', code);
// Drill down to the type annotation
// Program -> ClassDeclaration -> Body -> MethodDefinition(constructor) -> Value -> Params -> TSParameterProperty -> Parameter(Identifier) -> TypeAnnotation -> TSTypeReference

const classDec = result.program.body[0];
const constructor = classDec.body.body[0];
const param = constructor.value.params[0]; // TSParameterProperty
const identifier = param.parameter; // Identifier
const typeAnn = identifier.typeAnnotation.typeAnnotation; // TSTypeReference

console.log(JSON.stringify(typeAnn, null, 2));
