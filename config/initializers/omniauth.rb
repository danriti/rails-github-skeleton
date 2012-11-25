Rails.application.config.middleware.use OmniAuth::Builder do
  provider :github, 'ec5c781dc762da795641', '874f0d21db0d37351ebe906db3284564bef2b4aa'
end
