class SessionsController < ApplicationController
  def create
    #raise request.env["omniauth.auth"].to_yaml
    auth = env["omniauth.auth"]
    user = User.from_omniauth(auth)
    session[:user_id] = user.id
    session[:user_token] = auth["credentials"]
    redirect_to root_url, notice: "Signed in!"
  end

  def get
    cred = session[:user_token]
    if cred
      return render :json => {'status' => 'ok',
                              'data' => cred}
    else
      return render :json => {'status' => 'error',
                              'data' => nil}
    end
  end

  def destroy
    # Destroy session variables.
    session[:user_id] = nil
    session[:user_token] = nil
    redirect_to root_url, notice: "Signed out!"
  end
end
