import fetch from 'isomorphic-fetch'
import { initialize as initializeReduxForm } from 'redux-form'

export const GET_COMMENTS = 'GET_COMMENTS'
export const GET_COMMENTS_COMPLETE = 'GET_COMMENTS_COMPLETE'
export const GET_COMMENTS_ERROR = 'GET_COMMENTS_ERROR'

export const POST_COMMENT = 'POST_COMMENT'
export const POST_COMMENT_COMPLETE = 'POST_COMMENT_COMPLETE'
export const POST_COMMENT_ERROR = 'POST_COMMENT_ERROR'

export const FORM_NAME = 'postCommment'
export const FORM_FIELDS = [
  'commentContent',
  'authorName',
  'authorEmail',
  'authorUrl',
]

const websiteUrl = __CONFIG__.websiteUrl
const apiUrl = __CONFIG__.apiUrl

class ValidationError extends Error {
  constructor (data) {
    super()
    this.name = 'ValidationError'
    this.data = data
    this.stack = (new Error()).stack
  }
}

export function getComments ({ url, updateOnly = false }) {
  return async dispatch => {
    const noTrailingSlashUrl = url.replace(/[\/*]$/, '')
    dispatch({ type: GET_COMMENTS, url: noTrailingSlashUrl, updateOnly })
    try {
      const fetchUrl =
        `${websiteUrl}/comments${noTrailingSlashUrl}/comments.json`
      const response = await fetch(fetchUrl)
      const { status } = response
      if (status === 403 || status === 404) {
        dispatch({ type: GET_COMMENTS_COMPLETE, comments: [], updateOnly })
        return
      }
      const comments = await response.json()
      dispatch({ type: GET_COMMENTS_COMPLETE, comments, updateOnly })
    } catch (error) {
      dispatch({ type: GET_COMMENTS_ERROR, error, updateOnly })
    }
  }
}

function refetchCommentsWhilePending ({ url }) {
  return (dispatch, getState) => {
    let retryCounter = 0
    const interval = setInterval(async () => {
      const { comments: { pendingComments } } = getState()
      if (retryCounter++ > 10 || Object.keys(pendingComments).length === 0) {
        clearInterval(interval)
      } else {
        dispatch(getComments({ url, updateOnly: true }))
      }
    }, 5000)
  }
}

export function postComment ({
  url,
  pathname,
  commentContent,
  authorName,
  authorEmail,
  authorUrl,
}) {
  return async dispatch => {
    const noTrailingSlashUrl = url.replace(/[\/*]$/, '')
    const payload = {
      url: noTrailingSlashUrl,
      commentContent,
      authorName,
      authorEmail,
      authorUrl,
    }
    dispatch({ type: POST_COMMENT, payload })
    try {
      const apiPostUrl = `${apiUrl}/comments`
      const response = await fetch(
        apiPostUrl,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
      const { status } = response
      const responseData = await response.json()
      if (status === 201) {
        dispatch({ type: POST_COMMENT_COMPLETE, responseData, payload })
        dispatch(refetchCommentsWhilePending({ url: pathname }))
      } else if (status === 400) {
        const { errorMessage } = responseData
        if (!errorMessage) {
          throw new Error('Error occured while posting comment')
        }
        const parsedError = JSON.parse(errorMessage)
        const { error, data } = parsedError
        if (error === 'ValidationError') {
          throw new ValidationError(data)
        } else {
          throw new Error('Error occured while posting comment')
        }
      } else {
        throw new Error('Unexpected status on response')
      }
    } catch (error) {
      dispatch({ type: POST_COMMENT_ERROR, error })
      throw error
    }
  }
}

export function resetCommentForm ({ pathname, clearContent }) {
  return dispatch => {
    const savedPathname = localStorage.getItem('pathname')
    const data = {
      authorName: localStorage.getItem('authorName'),
      authorEmail: localStorage.getItem('authorEmail'),
      authorUrl: localStorage.getItem('authorUrl'),
    }
    if (!clearContent && pathname === savedPathname) {
      data.commentContent = localStorage.getItem('commentContent')
    }
    dispatch(initializeReduxForm(FORM_NAME, data, FORM_FIELDS))
  }
}
