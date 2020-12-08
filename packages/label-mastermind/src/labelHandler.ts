import { GitHub } from '@actions/github'
import { PRContext, IssueContext } from './conditions'
import { ConditionSetType, evaluator } from './evaluator'
import { Config } from './types'
import { Repo } from './api'
import { log } from '.'
import { utils } from './utils'
import { loggingData } from '@videndum/utilities'

/**
 * Apply Labels to Issues
 * @author IvanFon, TGTGamer, jbinda
 * @since 1.0.0
 */
export async function applyIssue({
  client,
  configs,
  config,
  context,
  labelIdToName,
  repo,
  dryRun
}: {
  client: GitHub
  configs: Config
  config: Config['issue']
  context: IssueContext
  labelIdToName: { [key: string]: string }
  repo: Repo
  dryRun: boolean
}) {
  const { issueProps, IDNumber } = context
  for (const [labelID, conditionsConfig] of Object.entries(config.labels)) {
    log(new loggingData('100', `Label: ${labelID}`))

    const shouldHaveLabel = evaluator(
      ConditionSetType.issue,
      conditionsConfig,
      issueProps
    )

    const labelName = labelIdToName[labelID]
    if (!labelName)
      throw new loggingData(
        '500',
        `Can't find configuration for ${labelID} within labels. Check spelling and that it exists`
      )
    const hasLabel = Boolean(
      context.issueProps.labels?.[labelName.toLowerCase()]
    )
    if (!shouldHaveLabel && hasLabel && context.issueProps.labels)
      delete context.issueProps.labels[labelName.toLowerCase()]
    if (
      shouldHaveLabel &&
      !hasLabel &&
      context.issueProps.labels &&
      configs.labels
    )
      context.issueProps.labels[labelName.toLowerCase()] =
        configs.labels[labelID]

    await utils.labels
      .addRemove({
        client,
        curLabels: context.issueProps.labels,
        labelID,
        labelName,
        IDNumber,
        hasLabel,
        repo,
        shouldHaveLabel,
        dryRun
      })
      .catch(err => {
        log(
          new loggingData(
            '500',
            `Error thrown while running addRemoveLabel: `,
            err
          )
        )
      })
  }
}

/**
 * Apply Labels to Pull Requests
 * @author IvanFon, TGTGamer, jbinda
 * @since 1.0.0
 */
export async function applyPR({
  client,
  configs,
  config,
  labelIdToName,
  context,
  repo,
  dryRun
}: {
  client: GitHub
  configs: Config
  config: Config['pr']
  labelIdToName: { [key: string]: string }
  context: PRContext
  repo: Repo
  dryRun: boolean
}) {
  const { prProps, IDNumber } = context
  for (const [labelID, conditionsConfig] of Object.entries(config.labels)) {
    log(new loggingData('100', `Label: ${labelID}`))

    const shouldHaveLabel = evaluator(
      ConditionSetType.pr,
      conditionsConfig,
      prProps
    )

    const labelName = labelIdToName[labelID]
    if (!labelName)
      throw new loggingData(
        '500',
        `Can't find configuration for ${labelID} within labels. Check spelling and that it exists`
      )
    const hasLabel = Boolean(context.prProps.labels?.[labelName.toLowerCase()])
    if (!shouldHaveLabel && hasLabel && context.prProps.labels)
      delete context.prProps.labels[labelName.toLowerCase()]
    if (
      shouldHaveLabel &&
      !hasLabel &&
      context.prProps.labels &&
      configs.labels
    )
      context.prProps.labels[labelName.toLowerCase()] = configs.labels[labelID]

    await utils.labels
      .addRemove({
        client,
        curLabels: context.prProps.labels,
        labelID,
        labelName,
        IDNumber,
        hasLabel,
        repo,
        shouldHaveLabel,
        dryRun
      })
      .catch(err => {
        log(
          new loggingData(
            '500',
            `Error thrown while running addRemoveLabel: `,
            err
          )
        )
      })
  }
}
