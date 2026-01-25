import { blankLinesBetweenStatementGroupsRule } from './src/rules/blank-lines-between-statement-groups';
import { memberOrderingRule } from './src/rules/member-ordering';
import { noAnyRule } from './src/rules/no-any';
import { noBracketNotationRule } from './src/rules/no-bracket-notation';
import { noCreateRequireRule } from './src/rules/no-create-require';
import { noDoubleAssertionRule } from './src/rules/no-double-assertion';
import { noDynamicImportRule } from './src/rules/no-dynamic-import';
import { noGlobalThisMutationRule } from './src/rules/no-globalthis-mutation';
import { noInlineObjectTypeRule } from './src/rules/no-inline-object-type';
import { noNonNullAssertionRule } from './src/rules/no-non-null-assertion';
import { noTsIgnoreRule } from './src/rules/no-ts-ignore';
import { noTombstoneRule } from './src/rules/no-tombstone';
import { noUmbrellaTypesRule } from './src/rules/no-umbrella-types';
import { noUnknownRule } from './src/rules/no-unknown';
import { noUnmodifiedLoopConditionRule } from './src/rules/no-unmodified-loop-condition';
import { paddingLineBetweenStatementsRule } from './src/rules/padding-line-between-statements';
import { singleExportedClassRule } from './src/rules/single-exported-class';
import { testAaaCommentsRule } from './src/rules/test-aaa-comments';
import { testBddTitleRule } from './src/rules/test-bdd-title';
import { testDescribeSutNameRule } from './src/rules/test-describe-sut-name';
import { testUnitFileMappingRule } from './src/rules/test-unit-file-mapping';
import { unusedImportsRule } from './src/rules/unused-imports';

const plugin = {
	meta: {
		name: 'bunner',
	},
	rules: {
		'blank-lines-between-statement-groups': blankLinesBetweenStatementGroupsRule,
		'member-ordering': memberOrderingRule,
		'padding-line-between-statements': paddingLineBetweenStatementsRule,
		'no-unmodified-loop-condition': noUnmodifiedLoopConditionRule,
			'no-tombstone': noTombstoneRule,
		'no-unknown': noUnknownRule,
		'no-double-assertion': noDoubleAssertionRule,
		'no-non-null-assertion': noNonNullAssertionRule,
		'no-ts-ignore': noTsIgnoreRule,
		'no-inline-object-type': noInlineObjectTypeRule,
		'no-bracket-notation': noBracketNotationRule,
		'no-dynamic-import': noDynamicImportRule,
		'no-globalthis-mutation': noGlobalThisMutationRule,
		'no-any': noAnyRule,
		'no-umbrella-types': noUmbrellaTypesRule,
		'no-create-require': noCreateRequireRule,
			'single-exported-class': singleExportedClassRule,
			'test-aaa-comments': testAaaCommentsRule,
			'test-bdd-title': testBddTitleRule,
			'test-describe-sut-name': testDescribeSutNameRule,
			'test-unit-file-mapping': testUnitFileMappingRule,
		'unused-imports': unusedImportsRule,
	},
};

export { plugin };

// eslint-disable-next-line import/no-default-export
export default plugin;