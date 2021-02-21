sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"../model/formatter"
], function (BaseController, JSONModel, MessageToast, Fragment, formatter) {
	"use strict";

	return BaseController.extend("demo.sap.proj_worklist1.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0,
					showFooter: false
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this.getOwnerComponent().getModel().metadataLoaded().then(function () {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});
			// Set the initial form to be the display one
			this._showFormFragment("Display");
		},
		
		onExit : function () {
			for (var sPropertyName in this._formFragments) {
				if (!this._formFragments.hasOwnProperty(sPropertyName) || this._formFragments[sPropertyName] == null) {
					return;
				}

				this._formFragments[sPropertyName].destroy();
				this._formFragments[sPropertyName] = null;
			}
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function () {
			var oViewModel = this.getModel("objectView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});
			oShareDialog.open();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var oModel = this.getModel();
			
			var sObjectId = oEvent.getParameter("arguments").objectId;
			var hasDraft = oEvent.getParameter("arguments").hasDraft;
			
			if (hasDraft == "true") {
				
				var uri = "/ZDEMO_C_Pro_TP_D(ProjectUUID=guid'" + sObjectId + "',IsActiveEntity=true)/DraftAdministrativeData";
				var that = this; 
				oModel.metadataLoaded().then(function() {
					oModel.read(uri, {
						success: function (oData) {
							
							var draftUUID = oData.DraftUUID;
							
							var sObjectPath = that.getModel().createKey("ZDEMO_C_Pro_TP_D", {
								ProjectUUID: draftUUID,
								IsActiveEntity: false
							});
							that._bindView("/" + sObjectPath);
							
							that._toggleButtonsAndView(true);
						}
					});
				});
				
			} else {
				this.getModel().metadataLoaded().then(function () {
					var sObjectPath = this.getModel().createKey("ZDEMO_C_Pro_TP_D", {
						ProjectUUID: sObjectId,
						IsActiveEntity: true
					});
					this._bindView("/" + sObjectPath);
					
					this._toggleButtonsAndView(false);
				}.bind(this));
			}

		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.ProjectUUID,
				sObjectName = oObject.Projdef;

			oViewModel.setProperty("/busy", false);
			// Add the object page to the flp routing history
			this.addHistoryEntry({
				title: this.getResourceBundle().getText("objectTitle") + " - " + sObjectName,
				icon: "sap-icon://enter-more",
				intent: "#demo-display&/ZDEMO_C_Pro_TP_D/" + sObjectId
			});

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		handleEditPress: function () {

			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			var sPath = oElementBinding.getPath(),
				oObject = oView.getModel().getObject(sPath),
				projectUUID = oObject.ProjectUUID,
				hasActive = oObject.hasActiveEntity;
			
			//creating draft
			var vChange = "true";
			var vActive = "true";
			
			var oUrlParams = {
				PreserveChanges: vChange,
				ProjectUUID: projectUUID,
				IsActiveEntity: vActive
			};
			// var oModel = this.getModel();

			var that = this;
			this.callFunctionPromise(this.getModel(), "/ZDEMO_C_Pro_TP_DEdit", oUrlParams ).then(function (response) {
				
				var sObjectPath = "/ZDEMO_C_Pro_TP_D(ProjectUUID=guid'" + response.ProjectUUID + "',IsActiveEntity=" + response.IsActiveEntity + ")";
				that._bindView(sObjectPath);
				that._toggleButtonsAndView(true);

			}).catch(function () {
				
			});
		},

		_toggleButtonsAndView: function (bEdit) {
			var oView = this.getView();
			
			//Show Page Footer
			var oViewModel = oView.getModel("objectView");
			oViewModel.setProperty("/showFooter", bEdit);
			
			// Show the appropriate action buttons
			oView.byId("edit").setVisible(!bEdit);

			// Set the right form type
			this._showFormFragment(bEdit ? "Change" : "Display");
			
			if (bEdit) {
				var oDraftIndi = this.byId("draftIndi");
				oDraftIndi.clearDraftState();
			}
		},

		_formFragments: {},

		_getFormFragment: function (sFragmentName) {
			var oFormFragment = this._formFragments[sFragmentName];

			if (oFormFragment) {
				return oFormFragment;
			}
	
			oFormFragment = sap.ui.xmlfragment(this.getView().getId(), "demo.sap.proj_worklist1.view." + sFragmentName, this);

			this._formFragments[sFragmentName] = oFormFragment;
			return this._formFragments[sFragmentName];
		},

		_showFormFragment: function (sFragmentName) {
			var oPage = this.byId("page");

			oPage.setContent(this._getFormFragment(sFragmentName));
		},

		callFunctionPromise: function (oDataModel, path, parameter) {
			var func = new Promise(function (a, b) {
				var success = function (response) {
					a(response);
				};
				var error = function () {
					b();
				};
				oDataModel.callFunction(path, {
					method: "POST",
					urlParameters: parameter,
					success: success,
					error: error
				});
			});
			return func;
		},
		saveProjectDraft: function () {

			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			var sPath = oElementBinding.getPath(),
				oObject = this.getModel().getObject(sPath),
				projectUUID = oObject.ProjectUUID;

			var proj = this.getView().byId("proj").getValue();
			var resp = this.getView().byId("resp").getValue();

			var uri = "/sap/opu/odata/sap/ZDEMO_C_PRO_TP_D_CDS/ZDEMO_C_Pro_TP_D(ProjectUUID=guid'" + projectUUID + "',IsActiveEntity=false)";

			var oPayload = {
				"__metadata": {
					"uri": uri,
					"type": "ZDEMO_C_PRO_TP_D_CDS.ZDEMO_C_Pro_TP_DType"
				},
				"Projdef": proj,
				"Responsibility": resp
			};
			
			// var that = this;
			var oDraftIndi = this.byId("draftIndi");
			oDraftIndi.clearDraftState();
			oDraftIndi.showDraftSaving();
			this.getModel().update("/ZDEMO_C_Pro_TP_D(ProjectUUID=guid'" + projectUUID + "',IsActiveEntity=false)", oPayload, {
				success: function (odata, Response) {
					// MessageToast.show("draft saved");
					oDraftIndi.showDraftSaved();
					oDraftIndi.clearDraftState();
				},
				error: function (odata, Response) {}
			});

		},
		onProjdefChange: function () {
			this.saveProjectDraft();
		},
		onResponsibilityChange: function () {
			this.saveProjectDraft();
		},
		onChange: function () {

		},
		onCancel:function() {
			this._toggleButtonsAndView(false);
		},
		onSave: function () {
			var editForm = this.getView().byId("formContainer"),
				context = editForm.getBindingContext(),
				projectUUID = context.getProperty("ProjectUUID");

			var oUrlParams = {
				ProjectUUID: projectUUID,
				IsActiveEntity: "false"
			};
			
			var that = this;
			this.callFunctionPromise(this.getModel(), "/ZDEMO_C_Pro_TP_DActivation", oUrlParams ).then(function (response) {
				
				var sPath = "/ZDEMO_C_Pro_TP_D(ProjectUUID=guid'" + response.ProjectUUID + "',IsActiveEntity=" + response.IsActiveEntity + ")";

				that.getView().bindElement({path: sPath});
				
				MessageToast.show("Project  " + response.Projdef + " has saved!");
				that._toggleButtonsAndView(false);

			}).catch(function () {
				MessageToast.show("Not able to save");
			});
		}

	});

});