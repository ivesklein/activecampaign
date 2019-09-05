'use strict'

const EventEmitter = require('events')
const HttpClient = require('./http')
const ContactEntity = require('./contact')
const FieldValueEntity = require('./fieldValue')

class ActiveCampaign extends EventEmitter {
  /**
   * Constructor
   *
   * @param {object} params
   * @property {string} params.url - ActiveCampaign's base url
   * @property {string} params.token - API Token
   * @property {Http} params.http - Http class
   */
  constructor (params) {
    super()

    if (params.hasOwnProperty('url') === false) {
      throw new Error('ActiveCampaign Class expects parameter url')
    }
    if (params.hasOwnProperty('token') === false) {
      throw new Error('ActiveCampaign Class expects parameter token')
    }

    this.url = params.url
    this.token = params.token
    this.http = HttpClient

    if (params.hasOwnProperty('http') === true) {
      this.http = params.http
    }
  }
}

class Contact extends ActiveCampaign {
  /**
   * Sync Contact, Custom Fields, and soon Tags
   *
   * @params {Object} contact - Contains the contact fields
   * @params {String} contact.email
   * @params {String} contact.firstName
   * @params {String} contact.lastName
   * @params {String} contact.phone
   * @params {Array} contact.fields
   */
  sync (contact, callback) {
    this._basicContactSync(contact, (err, contactObj) => {
      if (err) {
        callback(err, null)
      } else if (!contactObj._fields) {
        if(!contactObj._tags){
          callback(null, contactObj)
        }else{
          this._syncTags(contactObj, callback)  
        }
      } else {
        this._syncFields(contactObj, (err, contactObj2) => {
          if(err){
            callback(err)
          }else{
            if(!contactObj2._tags){
              callback(null, contactObj2)
            }else{
              this._syncTags(contactObj2, callback)  
            }
          }
        })
      }
    })
  }

  syncTags (contact, callback) {

  }

  /**
   * Sync basic contact fields
   *
   * @params {Object} contact - Contains the contact fields
   * @params {String} contact.email
   * @params {String} contact.firstName
   * @params {String} contact.lastName
   * @params {String} contact.phone
   */
  _basicContactSync (contact, callback) {
    let contactObj = new ContactEntity(contact)

    let headers = {}
    headers['Api-Token'] = this.token

    let payload = {}
    payload.url = this.url + '/api/3/contact/sync'
    payload.headers = headers
    payload.data = contactObj

    this.http.post(payload, (data) => {
      if (data.body.hasOwnProperty('errors') === true) {
        callback(data.body, null)
      } else {
        contactObj.id = data.body.contact.id
        callback(null, contactObj)
      }
    })
  }

  _syncFields (contact, callback) {
    let field = new Field({
      'url': this.url,
      'token': this.token
    })

    field
      .list()
      .then((customFields) => {
        contact.customFields = customFields.fields

        let fields = contact.fields
        let field = fields.pop()

        this.on('syncField', (res) => {
          if (fields.length === 0) {
            callback(null, contact)
          } else {
            field = fields.pop()
            this.syncField(field)
          }
        })

        this.syncField(field)
      }, null)
  }

  /**
   * Sync field value
   *
   * @params {Object} fieldValue
   * @params {String} fieldValue.contact
   * @params {String} fieldValue.field
   * @params {String} fieldValue.value
   */
  syncField (fieldValue, callback) {
    let fieldValueObj = new FieldValueEntity(fieldValue)

    let headers = {}
    headers['Api-Token'] = this.token

    let payload = {}
    payload.url = this.url + '/api/3/fieldValues'
    payload.headers = headers
    payload.data = fieldValueObj

    this.http.post(payload, (data) => {
      fieldValueObj.id = data.body.fieldValue.id
      this.emit('syncField', fieldValueObj)
    })
  }

  _syncTags (contact, callback) {
    let tag = new Tag({
      'url': this.url,
      'token': this.token
    })

    tag
      .list()
      .then((existingTags) => {

        let tags = contact.tags
        let tag = tags.pop()

        this.on('syncTag', (res) => {
          if (tags.length === 0) {
            callback(null, contact)
          } else {
            tag = tags.pop()
            this.syncTag(tag, contact, existingTags)
          }
        })

        this.syncTag(tag, contact, existingTags)
      }, null)
  }

  /**
   * Sync tags value
   *
   * @params {Object} fieldValue
   * @params {String} fieldValue.contact
   * @params {String} fieldValue.field
   * @params {String} fieldValue.value
   */
  syncTag (tagValue, contact, existingTags, callback) {

    // exist tag?
    const tag = existingTags.tags.find( eTag => {
      return eTag.tag === tagValue
    } )

    if(tag!==undefined){
      // save tag

      let headers = {}
      headers['Api-Token'] = this.token

      let payload = {}
      payload.url = this.url + '/api/3/contactTags'
      payload.headers = headers
      payload.data = {
        "contactTag": {
          "contact": contact.id,
          "tag" : tag.id
        }
      }

      this.http.post(payload, (data) => {
        this.emit('syncTag', data)
      })

    }else{
      //create tag and save
    }


  }

  /**
   * Delete a contact by Contact ID
   *
   * @params {Object} contact - Contains the contact fields
   * @params {int} contact.id
   */
  delete (contact, callback) {
    let contactObj = new ContactEntity(contact)

    let headers = {}
    headers['Api-Token'] = this.token

    let payload = {}
    payload.url = this.url + '/api/3/contacts/' + contactObj.id
    payload.headers = headers

    this.http.delete(payload, (data) => {
      if (data.body !== '') {
        callback(data.body, null)
      } else {
        callback(null, data.body)
      }
    })
  }
}

class Field extends ActiveCampaign {
  /**
   * Create or update contact along with custom contact fields
   *
   * @params {Object} contact - AC.Contact
   */
  list (contact) {
    let headers = {}
    headers['Api-Token'] = this.token

    let payload = {}
    payload.url = this.url + '/api/3/fields'
    payload.headers = headers

    return new Promise((resolve, reject) => {
      this.http.get(payload, (data) => {
        if (data.hasOwnProperty('error')) {
          reject(data.error);
        } else {
          resolve(data.body)
        }
      })
    })
  }
}

class Tag extends ActiveCampaign {
  /**
   * Create or update tag
   *
   * @params {Object} contact - AC.Contact
   */
  list (contact) {
    let headers = {}
    headers['Api-Token'] = this.token

    let payload = {}
    payload.url = this.url + '/api/3/tags'
    payload.headers = headers

    return new Promise((resolve, reject) => {
      this.http.get(payload, (data) => {
        if (data.hasOwnProperty('error')) {
          reject(data.error);
        } else {
          resolve(data.body)
        }
      })
    })
  }

  asignTag (contactId, tagName, callback) {
    this.list().then((existingTags) => {

      // exist tag?
      const tag = existingTags.tags.find( eTag => {
        return eTag.tag === tagName
      } )

      if(tag!==undefined){
        let headers = {}
        headers['Api-Token'] = this.token

        let payload = {}
        payload.url = this.url + '/api/3/contactTags'
        payload.headers = headers
        payload.data = {
          "contactTag": {
            "contact": contactId,
            "tag" : tag.id
          }
        }

        this.http.post(payload, (data) => {callback()})
      }else{
        callback("tag not exist")
      }
    })
  }

}

module.exports = {
  Contact: Contact,
  Field: Field,
  Tag: Tag
}
