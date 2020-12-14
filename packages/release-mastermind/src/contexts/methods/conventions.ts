import * as core from '@actions/core'
import { loggingData } from '@videndum/utilities'
import { Contexts } from '.'
import { log } from '../..'
import { IssueConfig, ProjectConfig, PullRequestConfig } from '../../../types'
import { api, ApiProps } from '../../api'
import { Condition, CurContext } from '../../conditions'
import { evaluator } from '../../evaluator'
import { semantic } from '../../utils/helper/semantic'
import respond from '../../utils/respond'

export function enforce(this: Contexts) {
  if (
    !this.config.enforceConventions ||
    !this.config.enforceConventions.conventions
  )
    throw new Error('No enforceable conventions')
  let required = 0,
    successful = 0,
    failedMessages: string[] = []
  this.config.enforceConventions.conventions.forEach(convention => {
    if (!convention.conditions) return
    required++
    if (convention.conditions == 'semanticTitle') {
      convention.requires = 1
      let conditions: Condition[] = []
      semantic.forEach(pattern => {
        conditions.push({
          type: 'titleMatches',
          pattern: `/^${pattern}(\\(.*\\))?:/i`
        })
      })
      if (convention.contexts) {
        convention.requires++
        convention.contexts.forEach(pattern => {
          conditions.push({
            type: 'titleMatches',
            pattern: `/\\(${pattern}\\):/i`
          })
        })
      }
      convention.failedComment =
        `Semantic Conditions failed - Please title your ${
          this.curContext.type == 'pr' ? 'pull request' : 'issue'
        } using one of the valid options:\r\n\r\n Types: ` +
        semantic.join(', ') +
        (convention.contexts
          ? `\r\n\r\n Contexts: ${convention.contexts?.join(', ')}`
          : '')
      convention.conditions = conditions
    }
    if (evaluator(convention, this.context.props)) {
      successful++
    } else {
      failedMessages.push(convention.failedComment)
    }
  })

  if (required > successful) {
    failedMessages.forEach(fail => core.setFailed(fail))
    !this.dryRun &&
      createConventionComment(
        this.curContext,
        this.config,
        { client: this.client, repo: this.repo },
        false,
        failedMessages
      )
    return false
  }
  log(
    new loggingData(
      '200',
      `All conventions successfully enforced. Moving to next step`
    )
  )
  !this.dryRun &&
    createConventionComment(
      this.curContext,
      this.config,
      { client: this.client, repo: this.repo },
      true
    )
  return true
}

async function createConventionComment(
  CurContext: CurContext,
  config: PullRequestConfig | IssueConfig | ProjectConfig,
  { client, repo }: ApiProps,
  success: boolean,
  failMessages?: string[]
) {
  if (!config.enforceConventions) return
  let prefix: string = `<!--releaseMastermind: Conventions-->${
      config.enforceConventions?.commentHeader || ''
    }\r\n\r\n`,
    suffix: string = `\r\n\r\n----------\r\n\r\nThis message will be automatically updated when you make this change\r\n\r\n${
      config.enforceConventions?.commentFooter || ''
    }`,
    body: string = prefix + failMessages?.join('\r\n\r\n') + suffix,
    commentList
  if (CurContext.type !== 'pr') {
    commentList = await api.issues.comments.list({
      client,
      IDNumber: CurContext.context.props.ID,
      repo
    })
  } else {
    commentList = await api.pullRequests.reviews.list({
      client,
      IDNumber: CurContext.context.props.ID,
      repo
    })
  }
  let previousComment: number | undefined
  if (commentList) {
    commentList.forEach((comment: any) => {
      if (comment.body.includes(prefix) && comment.state !== 'DISMISSED')
        previousComment = comment.id
    })
  }
  respond(CurContext, { client, repo }, success, previousComment, body)
}
