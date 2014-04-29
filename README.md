#BitBox installation guide OS X

##Install Xcode
   Xcode includes C++ support necessary to run many of the programs in this guide. We do not use Xcode at all, but it must be installed. You can install it from the Mac App Store.

##Get the code

   The application has many dependencies on other programs. In order to easily acquire these programs, we use one program, called Homebrew, to fetch them all. To get Homebrew, run in Terminal:
`ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)”`

`brew doctor`


   Git is software that makes it easy to collaborate on code. It it called a Version Control System because it tracks all changes made by all collaborators for a project and stores them in something called a repository (repo for short). Users edit files locally, and submit their changes to a centralized code base. This code base is often stored on a different machine. GitHub is a service for storing Git repositories on a separate machine. The BitBox repository is stored on GitHub.

   To communicate with GitHub and get the code, install Git:

`brew install git`

   To use Git and access GitHub, we need to use Terminal. Every Mac comes with Terminal installed, so you can open Terminal through Finder. Terminal lets you type-and-run commands that only applications normally run. This gives you greater control over the computer, so it's important to be careful when using Terminal.

   After opening Terminal, we will download the code using Git. Terminal always runs inside a folder--the same type of folder that stores your files. By default, Terminal starts out in your home folder, so if your username is bob your Terminal will start in /Users/bob. This means that all commands we run will modify the folder /Users/bob. To download the code using Git, run:

`git clone https://github.com/kompreni/credism`

You will now have a folder in /Users/bob called credism. To access that folder run: 

`cd credism`

##Run the code

With Homebrew installed, we can now install the dependencies necessary to run the application. 

[TODO explain node]
Install NodeJS:

`brew install node`

[TODO explain redis]
Install Redis:

`brew install redis`

`ln -sfv /usr/local/opt/redis/*.plist ~/Library/LaunchAgents`

`launchctl load ~/Library/LaunchAgents/homebrew.mxcl.redis.plist`

[TODO explain postgres]
Install Postgres:

`brew install postgres`

`ln -sfv /usr/local/opt/postgresql/*.plist ~/Library/LaunchAgents`

`launchctl load ~/Library/LaunchAgents/homebrew.mxcl.postgresql.plist`

[TODO create postgres tables/users]

   Our application is also dependent on a configuration file being present. Create an empty file by running:

`touch routes/cfg.js`

Add Python support and populate conversion rates in redis:

`sudo easy_install pip`

`sudo pip install redis`

`python misc/populate_conversion.py`

   Run the application using:

`node app dev`

##You can access the app at http://localhost:3000

	