# Overmodel
*Overmodel* is a simple system that allows cross-application configuration. It helps gather all the scattered configuration from different apps written in different technologies into one or more central repositories. This allows:

 - Centralization of the configuration
 - Flexible rule based configuration (i.e.: environment based configuration)
 - Separation of sensitive and non sensitive configuration items
 - Separation of concerns. Different parts of the model can be managed by different people

## Models

*Models* are locations where configuration is held. They can be represented by files. The file types supported are yaml, json and properties.

Let's define a variable named `favorite.fruit.name` and `favorite.fruit.color`

**model.json**

    {
        "favorite": {
	        "fruit": {
		        "name": {
					"value": "Apple",
					"_metadata": {
						"description": "This is my favorite fruit"
					}
		        },
		        "color": {
			        "value": "Red",
		  			"_metadata": {
						"description": "Color is important to me"
					}
		        }
	        }
        }
    }
**model.yaml**

    favorite:
	    fruit:
		    name:
			    value: Apple
			    _metadata:
				    description: This is my favorite fruit
		    color:
			    value: Red
			    _metadata:
				    description: Color is important to me
**model.properties**

    favorite.fruit.name=Apple
    favorite.fruit.name._metadata.description=This is my favorite fruit
    favorite.fruit.color=Red
    favorite.fruit.name._metadata.description=Color is important to me

Model files can be placed in several directories and files:

     - model-dir-open
	     - model
	    	 - model.json
	    	 - anotherfile.yaml
	    	 - yetanotherfile.properties
     - model-dir-sensitive
	     - model
	    	 - sensitive-model.yaml

## Rules

Rules let us define the different behaviour of the configuration for a given case. For instance, let's imagine that on the test environment we like *Green* apples. Then, we can override that value (`favorite.fruit.color=Green`) for this rule (`environment=test`) .

To represent this, we use the depth of a directory to represent a rule:

**model-dir-open/model/environment/test.properties**

    favorite.fruit.color=Green

Let's also imagine that our developer Jimmy doesn't even like apples, he likes yellow bananas. We can let him use them only on the test environment by defining the `developer=jimmy` rule, but deeper on the test environment:

**model-dir-open/model/environment/test/developer/jimmy.yaml**

    favorite.fruit.name=Banana
    favorite.fruit.name._metadata.description=I know I'm picky but I like them
    favorite.fruit.color=Yellow

So, our model structure now looks like this:

     - model-dir-open
	     - model
	    	 - model.json
	    	 - anotherfile.yaml
	    	 - yetanotherfile.properties
	    	 - environment
		    	 - test.properties
		    	 - deleloper
			    	 - jimmy.yaml
     - model-dir-sensitive:
	     - model
	    	 - sensitive-model.yaml

## Configuration files

Now it's time to inject the configuration into the files. This part where we inject the files is more coupled with the application we're trying to configure. 
Our application:

- myapp
    - src
    - etc
	    - config.json
    - foo
    - bar
    - ...

Let's imagine we have an application that makes use of the variables we have on the `etc/config.json` file:

    {
	    "myfruitName": "Apple",
	    "myfruitColor": "Red"
    }
Let's now apply the model to that file:

    

- myapp
	- **_overmodel**
		- **files**
			- **etc**
				- **config.json**
    - src
    - etc
	    - config.json
    - foo
    - bar
    - ...

`_overmodel/files/etc/config.json`

    {
	    "myfruitName": "{{favorite.fruit.name}}",
	    "myfruitColor": "{{favorite.fruit.color}}"
    }


## Applying the configuration

The configuration can be applied with a `nodejs` script provided in this package. To use it, create a `package.json` file or edit the existing one on the application you're trying to model and configure:

        {
	    "name": "myapp",
	    "version": "1.0.0",
	    "description": "this is my app",
	    "scripts": {
		    "overmodel": "node node_modules/overmodel/dist/index.js"
	    },
	    "devDependencies": {
		    "@testing-library/jest-dom": "^5.11.4",
		    "@testing-library/react": "^11.1.0",
		    "@testing-library/user-event": "^12.1.10",
		    "typescript": "^4.1.3"
	    },
		    "author": "Jimmy",
		    "license": "MIT",
		    "dependencies": {
		    "overmodel": "^1.0.12"
	    }
    }
To apply the configuration for the test environment for Jimmy:

    yarn overmodel apply --model-dir ../model-dir-open/model --model-dir ../model-dir-sensitive/model --rule environment=test --rule developer=jimmy

This command will inject the configuration variables from the configuration into the model file **`_overmodel/files/etc/config.json`** and write it into **`etc/config.json`**

## Subscribing to change on the configuration

*Overmodel* has a system to detect changes in the configuration files and point us to them in order to eventually model new configuration variables.

Say for instance that Jimmy needs a new configuration variable named _myFruitSize_:
 
`_overmodel/files/etc/config.json`

    {
	    "myfruitName": "Apple",
	    "myfruitColor": "Red",
	    "myFruitSize": "Big"
    }

He said Big because he likes big apples. He pushes the changes and the CI script will attempt to apply the configuration like this:

    yarn overmodel apply --model-dir ../model-dir-open/model --model-dir ../model-dir-sensitive/model --rule environment=ci

The output:

        The contents of etc/config.json changed since last time configuration was applied. Can't continue. Please model that file afain under _overmodel/files
    
    {
    
    "myfruitName": "Apple",
    
    "myfruitColor": "Red"
    
    }
    
    There were errors executing apply (error -2)
    
    error Command failed with exit code 254.
    
    info Visit **https://yarnpkg.com/en/docs/cli/run** for documentation about this command.

So, the script is warning us that there were changes on the configuration and that we need to model it again. After an exhaustive 3 hour meeting between the devops crew and the CMO, it was decided that we like *Medium* apples:

**model-dir-open/model/model.json**

    {
        "favorite": {
	        "fruit": {
		        "name": {
					"value": "Apple",
					"_metadata": {
						"description": "This is my favorite fruit"
					}
		        },
		        "color": {
			        "value": "Red",
		  			"_metadata": {
						"description": "Color is important to me"
					}
		        },
		        "size": {
			        "value": "Medium",
		  			"_metadata": {
						"description": "Size definitely matters, but let's not have them so big. It affects to taste"
					}
		        }
	        }
        }
    }

`_overmodel/files/etc/config.json`

    {
	    "myfruitName": "{{favorite.fruit.name}}",
	    "myfruitColor": "{{favorite.fruit.color}}",
	    "myFruitSize": "{{favorite.fruit.size}}"
    }

And if Jimmy still likes them big:
**model-dir-open/model/environment/test/developer/jimmy.yaml**

    favorite.fruit.name=Banana
    favorite.fruit.name._metadata.description=I know I'm picky but I like them
    favorite.fruit.color=Yellow
    favorite.fruit.size=Big

Now we retry to apply the configuration. For that, we will also accept the changes as we do it with the `--accept etc/config.json` flag:

    yarn overmodel apply --model-dir ../model-dir-open/model --model-dir ../model-dir-sensitive/model --rule environment=ci --accept etc/config.json

Now the output will be:

    Configuration successfully applied

The resulting `etc/config.json` file:

    {
	    "myfruitName": "Apple",
	    "myfruitColor": "Red",
	    "myFruitSize": "Medium"
    }

Also, if we attempt to use a variable that doesn't exist or that has no value for the given rules, the script will fail. This is convenient for variables that we need to ensure we set up properly for certain scenarios.

Imagine we'd like to define the tool we eat our fruit with, but we want it to be different per environment and we want to force it to be defined for any new environment defined in the future. Then we can define the new variable into the model, but omit it's value:

**model-dir-open/model/model.json**

    {
        "favorite": {
	        "fruit": {
		        "name": {
					"value": "Apple",
					"_metadata": {
						"description": "This is my favorite fruit"
					}
		        },
		        "color": {
			        "value": "Red",
		  			"_metadata": {
						"description": "Color is important to me"
					}
		        },
		        "size": {
			        "value": "Medium",
		  			"_metadata": {
						"description": "Size definitely matters, but let's not have them so big. It affects to taste"
					}
		        }
		        "eatingTool": {
		  			"_metadata": {
						"description": "Define the tool you eat your fruit with"
					}
		        }
	        }
        }
    }

**model-dir-open/model/environment/test.properties**

    favorite.fruit.tool=Plastic crappy knife

**model-dir-open/model/environment/ci.properties**

    favorite.fruit.tool=Virtual knife

**model-dir-open/model/environment/production.properties**

    favorite.fruit.tool=Silver knife

**model-dir-open/model/environment/test/developer/jimmy.yaml**

    favorite.fruit.name=Banana
    favorite.fruit.name._metadata.description=I know I'm picky but I like them
    favorite.fruit.color=Yellow
    favorite.fruit.size=Big
    favorite.fruit.tool=My own hands
    favorite.fruit.tool._metadata.description=Yeah, so what??
