const repoName = 'FairySave'
const repoBasePath = `/${repoName}`

const basePath =
  typeof window !== 'undefined'
    ? window.location.pathname.startsWith(repoBasePath)
      ? repoBasePath
      : ''
    : process.env.GITHUB_PAGES === 'true'
      ? repoBasePath
      : ''

export function assetPath(path: string) {
  if (!path) {
    return path
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`
}

export { basePath }
