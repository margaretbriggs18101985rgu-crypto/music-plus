import source from '@/resources/user-api/molan-v2.3.4.json'

// The user_api prefix deliberately uses the existing isolated script runtime.
export const BUILTIN_USER_API_ID = 'user_api_builtin_molan'
export const BUILTIN_USER_API: LX.UserApi.UserApiInfo = {
  id: BUILTIN_USER_API_ID,
  name: '墨澜聚合音源',
  description: '墨澜音乐源 v2.3.4',
  version: '2.3.4',
  author: '白姬9527(2449067834)',
  homepage: 'https://github.com/baiji6/molanyinyueyuan',
  allowShowUpdateAlert: false,
}
export const builtinUserApiScript = source.script
