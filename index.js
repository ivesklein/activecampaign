'use strict'

let ActiveCampaign = require('./lib/activecampaign')

let Contact = ActiveCampaign.Contact
let Field = ActiveCampaign.Field
let Tag = ActiveCampaign.Tag

/**
 * @module ActiveCampaign
 */
module.exports = {Contact, Field, Tag}
